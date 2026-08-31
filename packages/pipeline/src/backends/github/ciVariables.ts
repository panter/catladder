import type { CiVariableName } from "../../bash/ciVariables";
import { GHCR_REPOSITORY_EXPRESSION } from "./ghcr";

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
 * variables referenced by {@link GITHUB_CI_VARIABLES}.
 *
 * `registryImage` is the ghcr namespace to push to — the actions
 * expression for an all-lowercase repository, a lowercased literal for
 * a mixed-case one (see `./ghcr`).
 */
export const getGithubInjectedWorkflowEnv = (
  registryImage: string = GHCR_REPOSITORY_EXPRESSION,
): Record<string, string> => ({
  CL_JOB_TOKEN: "${{ github.token }}",
  CL_REGISTRY: "ghcr.io",
  CL_REGISTRY_IMAGE: registryImage,
  CL_REGISTRY_USER: "${{ github.actor }}",
  // empty outside of pull request events
  CL_PR_NUMBER: "${{ github.event.number }}",
});

/**
 * the names of the injected workflow-level env — the values differ per
 * repository (see {@link getGithubInjectedWorkflowEnv}), the names never
 * do, so lookups that only ask "does the workflow already provide this?"
 * use this instead.
 */
export const GITHUB_INJECTED_WORKFLOW_ENV_NAMES = new Set(
  Object.keys(getGithubInjectedWorkflowEnv()),
);
