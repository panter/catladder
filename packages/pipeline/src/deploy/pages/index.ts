import type { DeployConfigPages, DeployTypeDefinition } from "..";
import { createPagesDeployJobs } from "./deployJob";

export const PAGES_DEPLOY_TYPE: DeployTypeDefinition<DeployConfigPages> = {
  jobs: createPagesDeployJobs,
  // a broken site publish should not block the rest of the pipeline
  defaults: () => ({ allowFailure: true }),
  additionalSecretKeys: () => [],
  getAdditionalEnvVars: () => ({}),
};
