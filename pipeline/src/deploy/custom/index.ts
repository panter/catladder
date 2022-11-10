import type { DeployTypeDefinition } from "..";
import { createCustomDeployJobs } from "./deployJob";

export const CUSTOM_DEPLOY_TYPE: DeployTypeDefinition<"custom"> = {
  jobs: createCustomDeployJobs,
  defaults: () => ({}),
  additionalSecretKeys: () => [],
  getAdditionalEnvVars: () => ({}),
};
