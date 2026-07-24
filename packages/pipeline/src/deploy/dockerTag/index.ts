import type { DeployConfigDockerTag, DeployTypeDefinition } from "..";
import { createDockerTagDeployJobs } from "./deployJob";

export const DOCKER_TAG_DEPLOY_TYPE: DeployTypeDefinition<DeployConfigDockerTag> =
  {
    jobs: createDockerTagDeployJobs,
    defaults: () => ({}),
    additionalSecretKeys: () => [],
    getAdditionalEnvVars: () => ({}),
  };
