import type { DeployTypeDefinition } from "..";
import { createDockerTagDeployJobs } from "./deployJob";

export const DOCKER_TAG_DEPLOY_TYPE: DeployTypeDefinition<"dockerTag"> = {
  jobs: createDockerTagDeployJobs,
  defaults: () => ({}),
  additionalSecretKeys: () => [],
  getAdditionalEnvVars: () => ({}),
};
