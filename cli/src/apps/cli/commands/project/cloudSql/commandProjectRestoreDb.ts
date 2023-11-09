import type Vorpal from "vorpal";
import {
  getEnvVarsResolved,
  getPipelineContextByChoice,
} from "../../../../../config/getProjectConfig";
import type { CloudSqlBackgroundProxy } from "../../../../../gcloud/cloudSql/startProxy";
import { startCloudSqlProxyInBackground } from "../../../../../gcloud/cloudSql/startProxy";
import { envAndComponents } from "../utils/autocompletions";

import { ConnectionStringParser } from "connection-string-parser";
import { spawnCopyDb } from "../../../../../gcloud/cloudSql/copyDb";

export default async (vorpal: Vorpal) =>
  vorpal
    .command(
      "project-cloud-sql-restore-db",
      "restores a project db from one source to another target"
    )
    .action(async function restoreDb() {
      const envs = await envAndComponents();

      const { sourceEnvAndComponent } = await this.prompt({
        type: "list",
        name: "sourceEnvAndComponent",
        choices: envs,

        message: "Source instance (connection string or 'local')? 🤔 ",
      });

      const [sourceEnv, sourceComponent] = sourceEnvAndComponent.split(":");

      const sourceContext = await getPipelineContextByChoice(
        sourceEnv,
        sourceComponent
      );

      const sourceEnvVars = await getEnvVarsResolved(
        this,
        sourceContext.environment.shortName,
        sourceContext.componentName
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
        const parser = new ConnectionStringParser({
          scheme: "postgres",
          hosts: [],
        });

        const parsersResult = parser.parse(sourceEnvVars.DATABASE_URL);
        sourcePort = parsersResult.hosts?.[0]?.port;
        sourceUsername = parsersResult.username;
        sourcePassword = parsersResult.password;
        sourceDbName = parsersResult.endpoint;
      } else {
        sourcePort = 54399;
        sourceProxy = await startCloudSqlProxyInBackground({
          instanceName: sourceEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME,
          localPort: sourcePort,
        });

        sourceUsername = sourceEnvVars.DB_USER;
        sourcePassword = sourceEnvVars.DB_PASSWORD;
        sourceDbName = sourceEnvVars.DB_NAME;
      }

      const { targetEnvAndComponent } = await this.prompt({
        type: "list",
        name: "targetEnvAndComponent",
        choices: envs,

        message: "target env? 🤔 ",
      });

      const [targetEnv, targetComponent] = targetEnvAndComponent.split(":");

      const targetContext = await getPipelineContextByChoice(
        targetEnv,
        targetComponent
      );

      const targetEnvVars = await getEnvVarsResolved(
        this,
        targetContext.environment.shortName,
        targetContext.componentName
      );

      if (targetEnv === "local") {
        const parser = new ConnectionStringParser({
          scheme: "postgres",
          hosts: [],
        });

        const parsersResult = parser.parse(targetEnvVars.DATABASE_URL);

        targetPort = parsersResult.hosts?.[0]?.port;
        targetUsername = parsersResult.username;
        targetPassword = parsersResult.password;
        targetDbName = parsersResult.endpoint;
      } else {
        targetPort = 54499;
        targetProxy = await startCloudSqlProxyInBackground({
          instanceName: targetEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME,
          localPort: targetPort,
        });

        targetUsername = targetEnvVars.DB_USER;
        targetPassword = targetEnvVars.DB_PASSWORD;
        targetDbName = targetEnvVars.DB_NAME;
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
          `\n🚨 You are overriding a production environment. Please type in ${targetEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME} to continue\n\n`
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
