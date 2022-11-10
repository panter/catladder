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
  getAdditionalEnvVars: ({ fullName, env, componentName }) => {
    const HOST_CANONICAL =
      fullName.toLowerCase() +
      "-" +
      process.env[
        getSecretVarName(env, componentName, GCLOUD_RUN_CANONICAL_HOST_SUFFIX)
      ];

    return {
      HOST_CANONICAL,
    };
  },
};

export const GCLOUD_RUN_JOB_DEPLOY_TYPE: DeployTypeDefinition<"google-cloudrun-job"> =
  {
    jobs: createGoogleCloudRunDeployJobs,
    defaults: () => ({}),
    additionalSecretKeys: () => [GCLOUD_DEPLOY_CREDENTIALS_KEY],
    getAdditionalEnvVars: ({ deployConfig, fullName }) => {
      if (!deployConfig) {
        return {};
      }

      const jobName = fullName.toLowerCase();
      const CLOUD_RUN_JOB_TRIGGER_URL = `https://${deployConfig.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${deployConfig.projectId}/jobs/${jobName}:run`;

      return { CLOUD_RUN_JOB_TRIGGER_URL };
    },
  };

export const GCLOUD_RUN_DEPLOY_TYPES = {
  "google-cloudrun": GCLOUD_RUN_DEPLOY_TYPE,
  "google-cloudrun-job": GCLOUD_RUN_JOB_DEPLOY_TYPE,
};
