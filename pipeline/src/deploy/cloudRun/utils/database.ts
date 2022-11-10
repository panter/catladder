import { getCloudSqlVariables } from "..";
import type { Context } from "../../../types";
import { allowFailureInScripts } from "../../../utils/gitlab";
import type { DeployConfigCloudRun } from "../../types";

export const getDatabaseDeleteScript = (
  context: Context,
  deployConfig: DeployConfigCloudRun
) => {
  if (!deployConfig.cloudSql || !deployConfig.cloudSql.deleteDatabaseOnStop) {
    throw new Error("not possible");
  }

  const { DB_NAME } = context.componentConfig.vars?.public ?? {};

  if (!DB_NAME) {
    throw new Error("error: env vars did not specify DB_NAME");
  }

  const [projectId, region, instanceId] =
    deployConfig.cloudSql.instanceConnectionName.split(":");

  return `gcloud sql databases delete ${DB_NAME} --instance=${instanceId} --project ${projectId}`;
};

export const getDatabaseCreateScript = (
  context: Context,
  deployConfig: DeployConfigCloudRun
) => {
  if (!deployConfig.cloudSql) {
    throw new Error("not possible");
  }

  const { DB_NAME } = context.componentConfig.vars?.public ?? {};

  if (!DB_NAME) {
    throw new Error("error: env vars did not specify DB_NAME");
  }

  const [projectId, region, instanceId] =
    deployConfig.cloudSql.instanceConnectionName.split(":");
  // may fail if it already exists
  return allowFailureInScripts([
    `gcloud sql databases create ${DB_NAME} --instance=${instanceId} --project ${projectId}`,
  ]);
};
