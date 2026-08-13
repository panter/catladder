import type { DeployConfigCustom, DeployTypeDefinition } from "..";
import { createCustomDeployJobs } from "./deployJob";

export const CUSTOM_DEPLOY_TYPE: DeployTypeDefinition<DeployConfigCustom> = {
  jobs: createCustomDeployJobs,
  defaults: () => ({}),
  additionalSecretKeys: () => [],
  getAdditionalEnvVars: () => ({}),
};
