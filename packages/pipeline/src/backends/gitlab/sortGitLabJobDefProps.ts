import type { GitlabJobDef } from "../../types";

type GitlabJobDefKey = keyof GitlabJobDef;

/**
 * The desired order of GitLab job definition keys.
 */
const jobDefOrder: GitlabJobDefKey[] = [
  "stage",
  "tags",
  "image",
  "services",
  "variables",
  "before_script",
  "script",
  "after_script",
  "cache",
  "coverage",
  "environment",
  "release",
  "artifacts",
  "rules",
  "only",
  "except",
  "needs",
  "dependencies",
  "trigger",
  "retry",
  "interruptible",
  "allow_failure",
  "parallel",
  "hooks",
  "resource_group",
];

const sortGitLabJobDefKeys = (jobDef: GitlabJobDef): GitlabJobDefKey[] =>
  (Object.keys(jobDef) as GitlabJobDefKey[]).sort((a, b) =>
    jobDefOrder.indexOf(a) === -1 && jobDefOrder.indexOf(b) === -1
      ? 0
      : jobDefOrder.indexOf(a) === -1
        ? 1
        : jobDefOrder.indexOf(b) === -1
          ? -1
          : jobDefOrder.indexOf(a) - jobDefOrder.indexOf(b),
  );

/**
 * Sorts the properties of a GitLab job definition based on the desired order.
 *
 * This is only useful when generating a GitLab pipeline YAML file.
 */
export const sortGitLabJobDefProps = (jobDef: GitlabJobDef): GitlabJobDef =>
  sortGitLabJobDefKeys(jobDef).reduce(
    (acc, key) =>
      jobDef[key] !== undefined
        ? Object.assign(acc, { [key]: jobDef[key] })
        : acc,
    {} as GitlabJobDef,
  );
