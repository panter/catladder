import type { DeployConfigCloudRun, DeployTypeDefinition } from "..";
import {
  getBashVariable,
  joinBashExpressions,
} from "../../bash/BashExpression";
import type { BuildConfig } from "../../build";
import { getSecretVarName } from "../../context";
import type { EnvironmentContext } from "../../types/environmentContext";
import { sanitizeForBashVariable } from "../../utils/gitlab";
import { getFullDbName } from "../cloudSql/utils";
import { createGoogleCloudRunDeployJobs } from "./createJobs";
import { getCloudRunJobExecuteUrl } from "./utils/cloudRunExecutionUrl";
import {
  DEFAULT_DB_VARIABLES_MODE,
  getDatabaseConnectionString,
  getDatabaseJdbcUrl,
} from "./utils/database";

export const GCLOUD_DEPLOY_CREDENTIALS_KEY = "GCLOUD_DEPLOY_credentialsKey";

// FIXME: rename to internalHostSuffix, but this means that project-setup needs to be rerun, so its kindof a breaking change
export const GCLOUD_RUN_CANONICAL_HOST_SUFFIX =
  "GCLOUD_RUN_canonicalHostSuffix";

const getCloudSqlVariables = ({
  deployConfigRaw,
  environmentSlugPrefix,
  env,
  componentName,
  fullConfig,
}: EnvironmentContext<BuildConfig, DeployConfigCloudRun>) => {
  if (deployConfigRaw && deployConfigRaw.cloudSql) {
    const DB_NAME = getFullDbName(
      deployConfigRaw.cloudSql,
      fullConfig,
      environmentSlugPrefix,
      componentName,
    );

    const additionalQueryParamsString = Object.entries(
      deployConfigRaw.cloudSql.dbAdditionalQueryParams ?? {},
    )
      .map(([key, value]) => `&${key}=${value}`)
      .join("");

    const dbVars = {
      CLOUD_SQL_INSTANCE_CONNECTION_NAME:
        deployConfigRaw.cloudSql.instanceConnectionName,
      DB_NAME: DB_NAME,
      DB_USER: deployConfigRaw.cloudSql.dbUser ?? "postgres",
      DB_PASSWORD: "$" + getSecretVarName(env, componentName, "DB_PASSWORD"),
    };
    return {
      ...dbVars,
      DATABASE_URL: getDatabaseConnectionString(
        deployConfigRaw.cloudSql,
        dbVars,
      ).concat(additionalQueryParamsString),
      DATABASE_JDBC_URL: getDatabaseJdbcUrl(
        dbVars,
        deployConfigRaw.cloudSql.dbConnectionStringVariablesMode ??
          DEFAULT_DB_VARIABLES_MODE,
      ),
    };
  }
  return {};
};
export const GCLOUD_RUN_DEPLOY_TYPE: DeployTypeDefinition<DeployConfigCloudRun> =
  {
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
      {
        key: GCLOUD_DEPLOY_CREDENTIALS_KEY,
        hidden: true,
      },
      {
        key: GCLOUD_RUN_CANONICAL_HOST_SUFFIX,
        hidden: true,
      },
      ...(ctx.deployConfigRaw && ctx.deployConfigRaw.cloudSql
        ? [{ key: "DB_PASSWORD" }]
        : []),
    ],
    getAdditionalEnvVars: (ctx) => {
      const { fullName, env, componentName, deployConfigRaw } = ctx;

      const HOSTNAME_INTERNAL = joinBashExpressions(
        [
          fullName,
          getBashVariable(
            getSecretVarName(
              env,
              componentName,
              GCLOUD_RUN_CANONICAL_HOST_SUFFIX,
            ),
          ),
        ],
        "-",
      ).toLowerCase();
      const jobTriggers =
        deployConfigRaw && deployConfigRaw.jobs
          ? Object.fromEntries(
              Object.entries(deployConfigRaw.jobs).map(([name, job]) => [
                "CLOUD_RUN_JOB_TRIGGER_URL_" + sanitizeForBashVariable(name),
                getCloudRunJobExecuteUrl(name, {
                  appFullName: fullName,
                  projectId: deployConfigRaw.projectId,
                  region: deployConfigRaw.region,
                }),
              ]),
            )
          : {};

      return {
        HOSTNAME_INTERNAL,
        ...getCloudSqlVariables(ctx),
        ...jobTriggers,
        DEPLOY_CLOUD_RUN_PROJECT_ID: deployConfigRaw
          ? deployConfigRaw.projectId
          : undefined,
        DEPLOY_CLOUD_RUN_REGION: deployConfigRaw
          ? deployConfigRaw.region
          : undefined,
      };
    },
  };
