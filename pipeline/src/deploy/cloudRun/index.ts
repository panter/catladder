import type { DeployTypeDefinition } from "..";
import { createDeployJob } from "./deployJob";

export const GCLOUD_DEPLOY_CREDENTIALS_KEY = "GCLOUD_DEPLOY_credentialsKey";

export const GCLOUD_RUN_CANONICAL_HOST_SUFFIX =
  "GCLOUD_RUN_canonicalHostSuffix";
export const GCLOUD_RUN_DEPLOY_TYPE: DeployTypeDefinition<"google-cloudrun"> = {
  jobs: createDeployJob,
  defaults: () => ({}),
  additionalSecretKeys: () => [GCLOUD_DEPLOY_CREDENTIALS_KEY],
};
