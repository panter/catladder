import type { CiVariableName } from "../../bash/ciVariables";

/**
 * how gitlab names the predefined CI variables,
 * see https://docs.gitlab.com/ee/ci/variables/predefined_variables.html
 */
export const GITLAB_CI_VARIABLES: Record<CiVariableName, string> = {
  commitSha: "CI_COMMIT_SHA",
  jobToken: "CI_JOB_TOKEN",
  jobImage: "CI_JOB_IMAGE",
  registry: "CI_REGISTRY",
  registryImage: "CI_REGISTRY_IMAGE",
  registryUser: "CI_REGISTRY_USER",
  registryPassword: "CI_REGISTRY_PASSWORD",
};
