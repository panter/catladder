import { defineCommand } from "../../core/defineCommand";
import { spawnCopyDb } from "../../gcloud/cloudSql/copyDb";
import type { CloudSqlBackgroundProxy } from "../../gcloud/cloudSql/startProxy";
import { startCloudSqlProxyInBackground } from "../../gcloud/cloudSql/startProxy";

export const commandRestoreDb = defineCommand({
  name: "cloudsql restore-db",
  description: "restore a db from one source to another target",
  group: "cloudSQL",
  inputs: {
    source: {
      type: "string",
      message: "Source instance (connection string or 'local')? 🤔 ",
    },
    sourceLocalPort: {
      type: "number",
      message: "Local Port for source? 🤔 ",
      default: 5432,
    },
    sourceUsername: {
      type: "string",
      message: "Source Username? 🤔 ",
      default: "postgres",
    },
    sourcePassword: { type: "string", message: "Source Password? 🤔 " },
    sourceDbName: { type: "string", message: "Source DB name? 🤔 " },
    target: {
      type: "string",
      message: "Target INSTANCE (connection string or 'local')? 🤔  ",
    },
    targetLocalPort: {
      type: "number",
      message: "Local Port for target? 🤔 ",
      default: 5432,
    },
    targetUsername: {
      type: "string",
      message: "Target Username? 🤔 ",
      default: "postgres",
    },
    targetPassword: { type: "string", message: "Target Password? 🤔 " },
    targetDbName: { type: "string", message: "Target DB name? 🤔 " },
  },
  execute: async (ctx) => {
    const source = await ctx.get("source");

    let sourceProxy: CloudSqlBackgroundProxy;
    let targetProxy: CloudSqlBackgroundProxy;
    let sourcePort: number;
    let targetPort: number;

    if (source === "local") {
      sourcePort = await ctx.get("sourceLocalPort");
    } else {
      sourcePort = 54399;
      sourceProxy = await startCloudSqlProxyInBackground({
        instanceName: source,
        localPort: sourcePort,
      });
    }

    const sourceUsername = await ctx.get("sourceUsername");
    const sourcePassword = await ctx.get("sourcePassword");
    const sourceDbName = await ctx.get("sourceDbName");

    const target = await ctx.get("target");

    if (target === "local") {
      targetPort = await ctx.get("targetLocalPort");
    } else {
      targetPort = 54499;
      targetProxy = await startCloudSqlProxyInBackground({
        instanceName: target,
        localPort: targetPort,
      });
    }

    const targetUsername = await ctx.get("targetUsername");
    const targetPassword = await ctx.get("targetPassword");
    const targetDbName = await ctx.get("targetDbName");

    const shouldContinue = await ctx.confirm(
      `This will drop ${target}/${targetDbName} and replace it with ${source}/${sourceDbName}. Continue? 🤔 `,
    );
    if (!shouldContinue) {
      return;
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
      sourceProxy?.stop();
      targetProxy?.stop();
    }
  },
});
