import {
  BashExpression,
  joinBashExpressions,
  type StringOrBashExpression,
} from "@catladder/bash";
import type { ComponentContext } from "../../../types";
import { allowFailureInScripts, repeatOnFailure } from "../../../utils/gitlab";
import type {
  DeployConfigCloudRun,
  DeployConfigCloudRunCloudSql,
} from "../../types";

export const getDatabaseDeleteScript = (
  context: ComponentContext,
  deployConfig: DeployConfigCloudRun,
): string[] => {
  if (!deployConfig.cloudSql || !deployConfig.cloudSql.deleteDatabaseOnStop) {
    throw new Error("not possible");
  }
  const DB_NAME = context.environment.envVars["DB_NAME"];

  if (!DB_NAME) {
    throw new Error("error: env vars did not specify DB_NAME");
  }

  const [projectId, region, instanceId] =
    deployConfig.cloudSql.instanceConnectionName.split(":");
  // unfortunatly the database cannot be deleted right after the service has stopped, as it might still have connections
  // we have to repeate this process
  return [
    `echo "deleting database ${DB_NAME}..."`,
    `echo "👆 this can take multiple attemps (3-5min), because google cloud run may still have a connection to the database after the cloud run service is shut down"`,
    repeatOnFailure(
      `gcloud sql databases delete ${DB_NAME} --instance=${instanceId} --project ${projectId}`,
      {
        pauseInSeconds: 10,
        // connections normally clear within 3-5min; anything beyond is
        // a permanent error (missing permission, wrong instance, ...)
        maxAttempts: 30,
      },
    ),
  ];
};

export const getDatabaseCreateScript = (
  context: ComponentContext,
  deployConfig: DeployConfigCloudRun,
): string[] => {
  if (!deployConfig.cloudSql) {
    throw new Error("not possible");
  }

  const DB_NAME = context.environment.envVars["DB_NAME"];

  if (!DB_NAME) {
    throw new Error("error: env vars did not specify DB_NAME");
  }

  const [projectId, region, instanceId] =
    deployConfig.cloudSql.instanceConnectionName.split(":");
  // may fail if it already exists
  return allowFailureInScripts([
    `echo "ensuring Database..."`,
    `gcloud sql databases create ${DB_NAME} --instance=${instanceId} --project ${projectId}`,
  ]);
};

export type DBVariables = {
  CLOUD_SQL_INSTANCE_CONNECTION_NAME: StringOrBashExpression;
  DB_NAME: StringOrBashExpression;
  DB_USER: StringOrBashExpression;
  DB_PASSWORD: StringOrBashExpression;
};

/**
 * controls how variables in the connection string are handled
 *
 * - legacy: variables like $DB_USER will be kept as environment variables to be replaced at runtime (default). It is not using BashExpressions as this was not the case in the past.
 * - embedded: variables will be replaced with their actual values in the connection string
 *
 * We will remove the legacy mode in the future, as it is confusing. But its unclear whether its a breaking change in some edge cases
 */
export type DBVariablesMode = "legacy" | "embedded";

export const DEFAULT_DB_VARIABLES_MODE: DBVariablesMode = "legacy";

const getVariableOrValue = (
  key: keyof DBVariables,
  variables: DBVariables,
  mode: DBVariablesMode,
): StringOrBashExpression => {
  return mode === "legacy" ? `$${key}` : variables[key];
};

export const getDatabaseJdbcUrl = (
  variables: DBVariables,
  mode: DBVariablesMode,
) => {
  const parts = [
    "jdbc:postgresql:///",
    getVariableOrValue("DB_NAME", variables, mode),
    "?cloudSqlInstance=",
    getVariableOrValue("CLOUD_SQL_INSTANCE_CONNECTION_NAME", variables, mode),
    "&socketFactory=com.google.cloud.sql.postgres.SocketFactory&user=",
    getVariableOrValue("DB_USER", variables, mode),
    "&password=",
    getVariableOrValue("DB_PASSWORD", variables, mode),
  ];

  return joinBashExpressions(parts);
};

export const getRailsDatabaseConnectionString = (
  variables: DBVariables,
  mode: DBVariablesMode,
) => {
  const parts = [
    "postgresql://",
    getVariableOrValue("DB_USER", variables, mode),
    ":",
    getVariableOrValue("DB_PASSWORD", variables, mode),
    "@",
    encodeURIComponent(
      `/cloudsql/${variables.CLOUD_SQL_INSTANCE_CONNECTION_NAME}`,
    ),
    "/",
    getVariableOrValue("DB_NAME", variables, mode),
    "?",
  ];
  return joinBashExpressions(parts);
};

export const getPrismaDatabaseConnectionString = (
  variables: DBVariables,
  mode: DBVariablesMode,
) => {
  const parts = [
    "postgresql://",
    getVariableOrValue("DB_USER", variables, mode),
    ":",
    getVariableOrValue("DB_PASSWORD", variables, mode),
    "@localhost/",
    getVariableOrValue("DB_NAME", variables, mode),
    "?host=/cloudsql/",
    getVariableOrValue("CLOUD_SQL_INSTANCE_CONNECTION_NAME", variables, mode),
  ];
  return joinBashExpressions(parts);
};

export const getDatabaseConnectionString = (
  config: DeployConfigCloudRunCloudSql,
  variables: DBVariables,
): StringOrBashExpression => {
  const mode =
    config.dbConnectionStringVariablesMode ?? DEFAULT_DB_VARIABLES_MODE;
  switch (config.dbConnectionStringFormat) {
    case "jdbc":
      return getDatabaseJdbcUrl(variables, mode);
    case "rails":
      return getRailsDatabaseConnectionString(variables, mode);
    default:
      // prisma
      return getPrismaDatabaseConnectionString(variables, mode);
  }
};
