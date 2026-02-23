import type Vorpal from "vorpal";
import {
  getAllPipelineContexts,
  getEnvVarsResolved,
  getPipelineContextByChoice,
} from "../../../../../config/getProjectConfig";
import type { CloudSqlBackgroundProxy } from "../../../../../gcloud/cloudSql/startProxy";
import { startCloudSqlProxyInBackground } from "../../../../../gcloud/cloudSql/startProxy";

import { parseConnectionString } from "../../../../../gcloud/cloudSql/parseConnectionString";
import { spawnCopyDb } from "../../../../../gcloud/cloudSql/copyDb";
import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";

const hasCloudSql = (context: ComponentContext) => {
  const deployConfig = context.deploy?.config;
  if (isOfDeployType(deployConfig, "google-cloudrun")) {
    return !!deployConfig.cloudSql;
  }
  if (isOfDeployType(deployConfig, "kubernetes")) {
    return !!deployConfig.values?.cloudsql?.enabled;
  }
  return false;
};

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-cloud-sql-restore-db",
      "restores a project db from one source to another target",
    )
    .action(async function restoreDb() {
      const allContexts = await getAllPipelineContexts(undefined, {
        includeLocal: true,
      });
      const filteredContexts = allContexts.filter(hasCloudSql);
      const sortByEnv = (a: string, b: string) => {
        const aLocal = a.startsWith("local:");
        const bLocal = b.startsWith("local:");
        if (aLocal !== bLocal) return aLocal ? 1 : -1;
        return a.localeCompare(b);
      };
      const envs = filteredContexts
        .map((c) => `${c.env}:${c.name}`)
        .sort(sortByEnv);
      const targetEnvChoices = filteredContexts
        .map((c) => {
          const value = `${c.env}:${c.name}`;
          const isProd = c.environment.envType === "prod";
          return {
            name: isProd ? `⚠️ ${value}` : value,
            value,
          };
        })
        .sort((a, b) => sortByEnv(a.value, b.value));

      const { sourceEnvAndComponent } = await this.prompt({
        type: "list",
        name: "sourceEnvAndComponent",
        choices: envs,

        message: "Source instance (connection string or 'local')? 🤔 ",
      });

      const [sourceEnv, sourceComponent] = sourceEnvAndComponent.split(":");

      const sourceContext = await getPipelineContextByChoice(
        sourceEnv,
        sourceComponent,
      );

      const sourceEnvVars = await getEnvVarsResolved(
        this,
        sourceContext.env,
        sourceContext.name,
      );

      let sourceProxy: CloudSqlBackgroundProxy;
      let sourceDbName: string;

      let sourceUsername: string;
      let sourcePassword: string;

      let targetUsername: string;
      let targetPassword: string;
      let targetProxy: CloudSqlBackgroundProxy;

      let sourcePort: number;
      let targetPort: number;
      let targetDbName: string;

      const closeAll = () => {
        sourceProxy?.stop();
        targetProxy?.stop();
      };

      if (sourceEnv === "local") {
        const parsersResult = parseConnectionString(
          sourceEnvVars.DATABASE_URL.toString(),
        );
        sourcePort = parsersResult.hosts?.[0]?.port;
        sourceUsername = parsersResult.username;
        sourcePassword = parsersResult.password;
        sourceDbName = parsersResult.endpoint;
      } else {
        sourcePort = 54399;
        sourceProxy = await startCloudSqlProxyInBackground({
          instanceName:
            sourceEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME.toString(),
          localPort: sourcePort,
        });

        sourceUsername = sourceEnvVars.DB_USER.toString();
        sourcePassword = sourceEnvVars.DB_PASSWORD.toString();
        sourceDbName = sourceEnvVars.DB_NAME?.toString();
      }

      const { targetEnvAndComponent } = await this.prompt({
        type: "list",
        name: "targetEnvAndComponent",
        choices: targetEnvChoices,

        message: "target env? 🤔 ",
      });

      const [targetEnv, targetComponent] = targetEnvAndComponent.split(":");

      const targetContext = await getPipelineContextByChoice(
        targetEnv,
        targetComponent,
      );

      const targetEnvVars = await getEnvVarsResolved(
        this,
        targetContext.env,
        targetContext.name,
      );

      if (targetEnv === "local") {
        const parsersResult = parseConnectionString(
          targetEnvVars.DATABASE_URL.toString(),
        );

        targetPort = parsersResult.hosts?.[0]?.port;
        targetUsername = parsersResult.username;
        targetPassword = parsersResult.password;
        targetDbName = parsersResult.endpoint;
      } else {
        targetPort = 54499;
        targetProxy = await startCloudSqlProxyInBackground({
          instanceName:
            targetEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME.toString(),
          localPort: targetPort,
        });

        targetUsername = targetEnvVars.DB_USER.toString();
        targetPassword = targetEnvVars.DB_PASSWORD.toString();
        targetDbName = targetEnvVars.DB_NAME.toString();
      }

      const { shouldContinue } = await this.prompt({
        type: "confirm",
        name: "shouldContinue",
        message: `This will drop ${targetEnv}/${targetDbName} and replace it with ${sourceEnv}/${sourceDbName}. Continue? 🤔 `,
      });

      if (!shouldContinue) {
        this.log("abort");
        closeAll();
        return;
      }

      if (targetContext.environment.envType === "prod") {
        this.log(
          `\n🚨 You are overriding a production environment. Please type in ${targetEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME} to continue\n\n`,
        );
        const { confirmInstance } = await this.prompt({
          type: "input",
          name: "confirmInstance",
          message: "confirm: ",
        });

        if (
          confirmInstance !== targetEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME
        ) {
          this.log("abort");
          closeAll();
          return;
        }
      }

      try {
        await spawnCopyDb({
          targetPassword,
          targetPort,
          targetUsername,
          sourceUsername,
          sourcePassword,
          sourcePort,
          sourceDbName,
          targetDbName,
        });
      } finally {
        closeAll();
      }
    });
