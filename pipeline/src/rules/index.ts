import type { GitlabRule } from "../types";

const NEVER_ON_RELEASE_COMMIT: GitlabRule = {
  if: "$CI_COMMIT_MESSAGE =~ /^chore\\(release\\).*/",
  when: "never",
};
export const RULES_ALWAYS: GitlabRule[] = [
  {
    if: "$CI_COMMIT_TAG",
  },
  NEVER_ON_RELEASE_COMMIT,
  {
    if: "$CI_COMMIT_BRANCH =~ /^[0-9]+.([0-9]+|x).x$/",
  },
  {
    if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH",
  },
  {
    if: "$CI_MERGE_REQUEST_ID",
  },
];

export const RULE_CONDITION_MAIN_BRANCH =
  "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH";

export const RULES_RELEASE: GitlabRule[] = [
  NEVER_ON_RELEASE_COMMIT,
  {
    if: RULE_CONDITION_MAIN_BRANCH + ' && $AUTO_RELEASE == "true"',
    when: "on_success",
  },
  {
    if: RULE_CONDITION_MAIN_BRANCH,
    when: "manual",
  },
  {
    if: "$CI_COMMIT_BRANCH =~ /^[0-9]+.([0-9]+|x).x$/", // hotfix branches
    when: "manual",
  },
];
