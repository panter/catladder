import type { CiVariableName } from "../../bash/ciVariables";

/**
 * how the github backend names the predefined CI variables.
 *
 * GITHUB_* variables are provided by github actions natively; the CL_*
 * variables are injected by the {@link GithubBackend} itself (workflow or
 * job level), because github has no direct counterpart.
 */
export const GITHUB_CI_VARIABLES: Record<CiVariableName, string> = {
  commitSha: "GITHUB_SHA",
  jobToken: "CL_JOB_TOKEN",
  jobImage: "CL_JOB_IMAGE",
  registry: "CL_REGISTRY",
  registryImage: "CL_REGISTRY_IMAGE",
  registryUser: "CL_REGISTRY_USER",
  // github has no separate registry password: ghcr authenticates with
  // the workflow token, the same one CL_JOB_TOKEN carries
  registryPassword: "CL_JOB_TOKEN",
};

/**
 * the workflow-level env the backend injects to provide the CL_*
 * variables referenced by {@link GITHUB_CI_VARIABLES}
 */
export const GITHUB_INJECTED_WORKFLOW_ENV: Record<string, string> = {
  CL_JOB_TOKEN: "${{ github.token }}",
  CL_REGISTRY: "ghcr.io",
  CL_REGISTRY_IMAGE: "ghcr.io/${{ github.repository }}",
  CL_REGISTRY_USER: "${{ github.actor }}",
  // empty outside of pull request events
  CL_PR_NUMBER: "${{ github.event.number }}",
};
