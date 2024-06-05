import type { Context } from "../../../types";
import { allowFailureInScripts, repeatOnFailure } from "../../../utils/gitlab";
import type {
  DeployConfigCloudRun,
  DeployConfigCloudRunCloudSql,
} from "../../types";

export const getDatabaseDeleteScript = (
  context: Context,
  deployConfig: DeployConfigCloudRun
): string[] => {
  if (!deployConfig.cloudSql || !deployConfig.cloudSql.deleteDatabaseOnStop) {
    throw new Error("not possible");
  }
  const { DB_NAME } = context.environment.envVars ?? {};

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
      }
    ),
  ];
};

export const getDatabaseCreateScript = (
  context: Context,
  deployConfig: DeployConfigCloudRun
): string[] => {
  if (!deployConfig.cloudSql) {
    throw new Error("not possible");
  }

  const { DB_NAME } = context.environment.envVars ?? {};

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

export const DATABASE_JDBC_URL =
  "jdbc:postgresql:///$DB_NAME?cloudSqlInstance=$CLOUD_SQL_INSTANCE_CONNECTION_NAME&socketFactory=com.google.cloud.sql.postgres.SocketFactory&user=$DB_USER&password=$DB_PASSWORD";

export const getDatabaseConnectionString = (
  config: DeployConfigCloudRunCloudSql
): string => {
  switch (config.dbConnectionStringFormat) {
    case "jdbc":
      return DATABASE_JDBC_URL;
    case "rails":
      return `postgresql://$DB_USER:$DB_PASSWORD@${encodeURIComponent(
        `/cloudsql/${config.instanceConnectionName}`
      )}/$DB_NAME?`;
    default:
      // prisma
      return "postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME?host=/cloudsql/$CLOUD_SQL_INSTANCE_CONNECTION_NAME";
  }
};
