import { defineCommand } from "../../core/defineCommand";
import {
  getAllPipelineContexts,
  getEnvVarsResolved,
  getPipelineContextByChoice,
} from "../../config/getProjectConfig";
import { hasCloudSql } from "../availability";
import type { CloudSqlBackgroundProxy } from "../../gcloud/cloudSql/startProxy";
import { startCloudSqlProxyInBackground } from "../../gcloud/cloudSql/startProxy";
import { parseConnectionString } from "../../gcloud/cloudSql/parseConnectionString";
import { spawnCopyDb } from "../../gcloud/cloudSql/copyDb";
import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";

const componentHasCloudSql = (context: ComponentContext) => {
  const deployConfig = context.deploy?.config;
  if (isOfDeployType(deployConfig, "google-cloudrun")) {
    return !!deployConfig.cloudSql;
  }
  if (isOfDeployType(deployConfig, "kubernetes")) {
    return !!deployConfig.values?.cloudsql?.enabled;
  }
  return false;
};

export const commandProjectRestoreDb = defineCommand({
  name: "project cloudsql restore-db",
  description: "restores a project db from one source to another target",
  group: "project",
  isAvailable: hasCloudSql(),
  inputs: {
    source: {
      type: "string",
      message: "Source instance? 🤔 ",
      choices: async () => {
        const allContexts = await getAllPipelineContexts(undefined, {
          includeLocal: true,
        });
        const sortByEnv = (a: string, b: string) => {
          const aLocal = a.startsWith("local:");
          const bLocal = b.startsWith("local:");
          if (aLocal !== bLocal) return aLocal ? 1 : -1;
          return a.localeCompare(b);
        };
        return allContexts
          .filter(componentHasCloudSql)
          .map((c: any) => `${c.env}:${c.name}`)
          .sort(sortByEnv);
      },
    },
    target: {
      type: "string",
      message: "target env? 🤔 ",
      choices: async () => {
        const allContexts = await getAllPipelineContexts(undefined, {
          includeLocal: true,
        });
        const sortByEnv = (a: string, b: string) => {
          const aLocal = a.startsWith("local:");
          const bLocal = b.startsWith("local:");
          if (aLocal !== bLocal) return aLocal ? 1 : -1;
          return a.localeCompare(b);
        };
        return allContexts
          .filter(componentHasCloudSql)
          .map((c: any) => {
            const value = `${c.env}:${c.name}`;
            const isProd = c.environment.envType === "prod";
            return {
              name: isProd ? `⚠️ ${value}` : value,
              value,
            };
          })
          .sort((a: any, b: any) => sortByEnv(a.value, b.value));
      },
    },
    confirmInstance: {
      type: "string",
      message: "confirm: ",
    },
  },
  execute: async (ctx) => {
    const source = await ctx.get("source");

    const [sourceEnv, sourceComponent] = source.split(":");
    const sourceContext = await getPipelineContextByChoice(
      sourceEnv,
      sourceComponent,
    );
    const sourceEnvVars = await getEnvVarsResolved(
      ctx,
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

    const target = await ctx.get("target");

    const [targetEnv, targetComponent] = target.split(":");
    const targetContext = await getPipelineContextByChoice(
      targetEnv,
      targetComponent,
    );
    const targetEnvVars = await getEnvVarsResolved(
      ctx,
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

    const shouldContinue = await ctx.confirm(
      `This will drop ${targetEnv}/${targetDbName} and replace it with ${sourceEnv}/${sourceDbName}. Continue? 🤔 `,
    );
    if (!shouldContinue) {
      ctx.log("abort");
      closeAll();
      return;
    }

    if (targetContext.environment.envType === "prod") {
      ctx.log(
        `\n🚨 You are overriding a production environment. Please type in ${targetEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME} to continue\n\n`,
      );
      const confirmInstance = await ctx.get("confirmInstance");
      if (
        confirmInstance !== targetEnvVars.CLOUD_SQL_INSTANCE_CONNECTION_NAME
      ) {
        ctx.log("abort");
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
  },
});
