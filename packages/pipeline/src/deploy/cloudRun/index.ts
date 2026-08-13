import type { DeployConfigCloudRun, DeployTypeDefinition } from "..";
import { joinBashExpressions } from "@catladder/bash";
import type { BuildConfig } from "../../build";
import { getSecretVarName } from "../../context";
import { getGcloudProjectNumber } from "../../store";
import type { EnvironmentContext } from "../../types/environmentContext";
import {
  collapseableSection,
  sanitizeForBashVariable,
} from "../../utils/gitlab";
import { getFullDbName } from "../cloudSql/utils";
import { createGoogleCloudRunDeployJobs } from "./createJobs";
import { getCloudRunJobExecuteUrl } from "./utils/cloudRunExecutionUrl";
import {
  DEFAULT_DB_VARIABLES_MODE,
  getDatabaseConnectionString,
  getDatabaseJdbcUrl,
} from "./utils/database";
import {
  getRawServiceNameForEnvContext,
  getServiceNameForEnvContext,
} from "./utils/getServiceName";

export const GCLOUD_DEPLOY_CREDENTIALS_KEY = "GCLOUD_DEPLOY_credentialsKey";

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
        componentName,
      ).concat(additionalQueryParamsString),
      DATABASE_JDBC_URL: getDatabaseJdbcUrl(
        dbVars,
        deployConfigRaw.cloudSql.dbConnectionStringVariablesMode ??
          DEFAULT_DB_VARIABLES_MODE,
        componentName,
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
      // deploy-time credentials don't exist for the local env
      ...(ctx.envType !== "local"
        ? [
            {
              key: GCLOUD_DEPLOY_CREDENTIALS_KEY,
              hidden: true,
            },
          ]
        : []),
      ...(ctx.deployConfigRaw && ctx.deployConfigRaw.cloudSql
        ? [{ key: "DB_PASSWORD" }]
        : []),
    ],
    getAdditionalEnvVars: (ctx) => {
      const { fullName, deployConfigRaw, envType, fullConfig } = ctx;

      // cloud run's deterministic url host:
      // `<service>-<projectNumber>.<region>.run.app` — computable at
      // generation time. For review envs the service name part still
      // contains a runtime expression (the review slug), so the host stays
      // a bash expression there; the suffix is always a literal.
      //
      // The service name has to come from getRawServiceNameForEnvContext,
      // not from fullName: it is shortened when the label would otherwise
      // exceed what cloud run serves deterministically, and the url must
      // name the service that is actually deployed.
      const HOSTNAME_INTERNAL =
        deployConfigRaw && envType !== "local"
          ? joinBashExpressions(
              [
                getRawServiceNameForEnvContext(ctx),
                `${getGcloudProjectNumber(
                  fullConfig,
                  deployConfigRaw.projectId,
                )}.${deployConfigRaw.region}.run.app`,
              ],
              "-",
            ).toLowerCase()
          : undefined;
      const jobTriggers =
        deployConfigRaw && deployConfigRaw.jobs
          ? Object.fromEntries(
              Object.entries(deployConfigRaw.jobs)
                .filter(([name, job]) => Boolean(job))
                .map(([name, job]) => [
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
        ...(HOSTNAME_INTERNAL ? { HOSTNAME_INTERNAL } : {}),
        ...getCloudSqlVariables(ctx),
        ...jobTriggers,
        DEPLOY_CLOUD_RUN_SERVICE_NAME: getServiceNameForEnvContext(ctx),
        DEPLOY_CLOUD_RUN_PROJECT_ID: deployConfigRaw
          ? deployConfigRaw.projectId
          : undefined,
        DEPLOY_CLOUD_RUN_REGION: deployConfigRaw
          ? deployConfigRaw.region
          : undefined,
      };
    },
    verifyJobSetupScript: (context) => {
      const deployConfig = context.deploy?.config as
        | DeployConfigCloudRun
        | undefined;
      const service = deployConfig?.service;
      const serviceConfig = typeof service === "object" ? service : undefined;
      if (serviceConfig?.allowUnauthenticated !== false) {
        return [];
      }
      // the service requires IAM auth: provide application default credentials
      // so the verify command can fetch identity tokens for the deployed service
      return collapseableSection(
        "verifygcloudauth",
        "Setup google application credentials",
      )([
        `echo "$${GCLOUD_DEPLOY_CREDENTIALS_KEY}" > "$CI_PROJECT_DIR/.gcloud-sa.json"`,
        `export GOOGLE_APPLICATION_CREDENTIALS="$CI_PROJECT_DIR/.gcloud-sa.json"`,
      ]);
    },
  };
