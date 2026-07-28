import {
  BashExpression,
  joinBashExpressions,
  VariableReference,
  VariableValueContainingReferences,
  type StringOrBashExpression,
  type VariableValue,
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
 * - embedded (default): variables are replaced with the component's final values in the connection string. This makes the connection string usable from other components (e.g. via ${otherComponent:DATABASE_URL}) and respects overrides of DB_USER, DB_PASSWORD, etc. in vars.public (e.g. DB_PASSWORD: "${otherComponent:DB_PASSWORD}" when reusing another component's database)
 * - legacy: variables like $DB_USER are kept as environment variable names to be expanded by the shell that consumes the string. Only correct within the component's own jobs; referencing such a connection string from another component yields the wrong values. Kept as an escape hatch, will be removed in a future major
 */
export type DBVariablesMode = "legacy" | "embedded";

export const DEFAULT_DB_VARIABLES_MODE: DBVariablesMode = "embedded";

type DbUrlPart = StringOrBashExpression | VariableReference;

const getVariableOrValue = (
  key: keyof DBVariables,
  mode: DBVariablesMode,
  componentName: string,
): DbUrlPart => {
  // in embedded mode we reference the component's own env var, which gets
  // resolved to its final value (including vars.public overrides) after all
  // env vars have been merged
  return mode === "legacy"
    ? `$${key}`
    : new VariableReference(componentName, key);
};

const joinDbUrlParts = (
  parts: DbUrlPart[],
  mode: DBVariablesMode,
): VariableValue =>
  mode === "legacy"
    ? joinBashExpressions(parts as StringOrBashExpression[])
    : new VariableValueContainingReferences(parts);

export const getDatabaseJdbcUrl = (
  variables: DBVariables,
  mode: DBVariablesMode,
  componentName: string,
) => {
  const parts = [
    "jdbc:postgresql:///",
    getVariableOrValue("DB_NAME", mode, componentName),
    "?cloudSqlInstance=",
    getVariableOrValue(
      "CLOUD_SQL_INSTANCE_CONNECTION_NAME",
      mode,
      componentName,
    ),
    "&socketFactory=com.google.cloud.sql.postgres.SocketFactory&user=",
    getVariableOrValue("DB_USER", mode, componentName),
    "&password=",
    getVariableOrValue("DB_PASSWORD", mode, componentName),
  ];

  return joinDbUrlParts(parts, mode);
};

export const getRailsDatabaseConnectionString = (
  variables: DBVariables,
  mode: DBVariablesMode,
  componentName: string,
) => {
  const parts = [
    "postgresql://",
    getVariableOrValue("DB_USER", mode, componentName),
    ":",
    getVariableOrValue("DB_PASSWORD", mode, componentName),
    "@",
    encodeURIComponent(
      `/cloudsql/${variables.CLOUD_SQL_INSTANCE_CONNECTION_NAME}`,
    ),
    "/",
    getVariableOrValue("DB_NAME", mode, componentName),
    "?",
  ];
  return joinDbUrlParts(parts, mode);
};

export const getPrismaDatabaseConnectionString = (
  variables: DBVariables,
  mode: DBVariablesMode,
  componentName: string,
) => {
  const parts = [
    "postgresql://",
    getVariableOrValue("DB_USER", mode, componentName),
    ":",
    getVariableOrValue("DB_PASSWORD", mode, componentName),
    "@localhost/",
    getVariableOrValue("DB_NAME", mode, componentName),
    "?host=/cloudsql/",
    getVariableOrValue(
      "CLOUD_SQL_INSTANCE_CONNECTION_NAME",
      mode,
      componentName,
    ),
  ];
  return joinDbUrlParts(parts, mode);
};

export const getDatabaseConnectionString = (
  config: DeployConfigCloudRunCloudSql,
  variables: DBVariables,
  componentName: string,
): VariableValue => {
  const mode =
    config.dbConnectionStringVariablesMode ?? DEFAULT_DB_VARIABLES_MODE;
  switch (config.dbConnectionStringFormat) {
    case "jdbc":
      return getDatabaseJdbcUrl(variables, mode, componentName);
    case "rails":
      return getRailsDatabaseConnectionString(variables, mode, componentName);
    default:
      // prisma
      return getPrismaDatabaseConnectionString(variables, mode, componentName);
  }
};
