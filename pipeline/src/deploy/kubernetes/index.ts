import type { DeployTypeDefinition } from "..";
import { additionalKubernetesSecretKeys } from "./additionalSecretKeys";
import { createKubernetesDeployJobs } from "./deployJob";

export const KUBERNETES_DEPLOY_TYPE: DeployTypeDefinition<"kubernetes"> = {
  jobs: createKubernetesDeployJobs,
  defaults: () => ({}),
  additionalSecretKeys: additionalKubernetesSecretKeys,
};
