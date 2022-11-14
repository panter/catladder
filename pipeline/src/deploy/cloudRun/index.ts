import type { DeployTypeDefinition } from "..";
import { getSecretVarName } from "../../context";
import { createGoogleCloudRunDeployJobs } from "./deployJob";

export const GCLOUD_DEPLOY_CREDENTIALS_KEY = "GCLOUD_DEPLOY_credentialsKey";

export const GCLOUD_RUN_CANONICAL_HOST_SUFFIX =
  "GCLOUD_RUN_canonicalHostSuffix";

export const GCLOUD_RUN_DEPLOY_TYPE: DeployTypeDefinition<"google-cloudrun"> = {
  jobs: createGoogleCloudRunDeployJobs,
  defaults: () => ({}),
  additionalSecretKeys: () => [GCLOUD_DEPLOY_CREDENTIALS_KEY],
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
              "CLOUD_RUN_JOB_TRIGGER_URL_" + name,
              `https://${deployConfigRaw.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${deployConfigRaw.projectId}/jobs/${name}:run`,
            ])
          )
        : {};

    return {
      HOST_CANONICAL,
      ...jobTriggers,
    };
  },
};
