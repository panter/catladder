import type { DeployTypeDefinition } from "..";
import { getSecretVarName } from "../../context";
import { sanitizeForBashVariable } from "../../utils/gitlab";
import type { EnvironmentContext } from "../../types/environmentContext";
import { createGoogleCloudRunDeployJobs } from "./deployJob";

export const GCLOUD_DEPLOY_CREDENTIALS_KEY = "GCLOUD_DEPLOY_credentialsKey";

export const GCLOUD_RUN_CANONICAL_HOST_SUFFIX =
  "GCLOUD_RUN_canonicalHostSuffix";

const getCloudSqlVariables = ({
  deployConfigRaw,
  environmentSlug,
  env,
  componentName,
  fullConfig,
}: EnvironmentContext<any, "google-cloudrun">) => {
  if (deployConfigRaw && deployConfigRaw.cloudSql) {
    const DB_NAME = [
      deployConfigRaw.cloudSql.dbNamePrefix ??
        `${fullConfig.customerName}-${fullConfig.appName}`,
      environmentSlug,
    ]
      .filter(Boolean)
      .join("-");

    return {
      CLOUD_SQL_INSTANCE_CONNECTION_NAME:
        deployConfigRaw.cloudSql.instanceConnectionName,
      DB_NAME: DB_NAME,
      DB_USER: "postgres",
      DB_PASSWORD: "$" + getSecretVarName(env, componentName, "DB_PASSWORD"),
      DATABASE_URL: `postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME?host=/cloudsql/$CLOUD_SQL_INSTANCE_CONNECTION_NAME`,
    };
  }
  return {};
};
export const GCLOUD_RUN_DEPLOY_TYPE: DeployTypeDefinition<"google-cloudrun"> = {
  jobs: createGoogleCloudRunDeployJobs,
  defaults: ({ deployConfigRaw, envType }) => {
    if (deployConfigRaw && deployConfigRaw.cloudSql) {
      return {
        cloudSql: {
          deleteDatabaseOnStop: envType === "review",
        },
      };
    }
    return {};
  },
  additionalSecretKeys: (ctx) => [
    GCLOUD_DEPLOY_CREDENTIALS_KEY,
    ...(ctx.deployConfigRaw && ctx.deployConfigRaw.cloudSql
      ? ["DB_PASSWORD"]
      : []),
  ],
  getAdditionalEnvVars: (ctx) => {
    const { fullName, env, componentName, deployConfigRaw } = ctx;
    const HOST_CANONICAL =
      fullName.toLowerCase() +
      "-" +
      process.env[
        getSecretVarName(env, componentName, GCLOUD_RUN_CANONICAL_HOST_SUFFIX)
      ];

    const jobTriggers =
      deployConfigRaw && deployConfigRaw.jobs
        ? Object.fromEntries(
            Object.entries(deployConfigRaw.jobs).map(([name, job]) => [
              "CLOUD_RUN_JOB_TRIGGER_URL_" + sanitizeForBashVariable(name),
              `https://${deployConfigRaw.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${deployConfigRaw.projectId}/jobs/${name}:run`,
            ])
          )
        : {};

    return {
      HOST_CANONICAL,
      ...getCloudSqlVariables(ctx),
      ...jobTriggers,
    };
  },
};
