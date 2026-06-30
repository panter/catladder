import type { GitlabRule } from "../types";
export const RULE_CONDITION_MAIN_BRANCH =
  "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH";

export const RULE_CONDITION_RELEASE_COMMIT =
  "$CI_COMMIT_MESSAGE =~ /^chore\\(release\\).*/";

export const RULE_CONDITION_NOT_RELEASE_COMMIT =
  "$CI_COMMIT_MESSAGE !~ /^chore\\(release\\).*/";

// NOT(release_commit AND push) — skip release commits on push, but allow
// manually triggered (web/API) pipelines even on release commits.
export const RULE_CONDITION_NOT_RELEASE_COMMIT_ON_PUSH =
  '($CI_COMMIT_MESSAGE !~ /^chore\\(release\\).*/ || $CI_PIPELINE_SOURCE != "push")';

export const RULE_IS_MAIN_BRANCH: GitlabRule = {
  if: RULE_CONDITION_MAIN_BRANCH,
};
export const RULE_IS_MAIN_BRANCH_AND_NOT_RELEASE_COMMIT: GitlabRule = {
  if:
    RULE_CONDITION_MAIN_BRANCH +
    " && " +
    RULE_CONDITION_NOT_RELEASE_COMMIT_ON_PUSH,
};
export const RULE_NEVER_ON_RELEASE_COMMIT: GitlabRule = {
  if: RULE_CONDITION_RELEASE_COMMIT,
  when: "never",
};
// currently, we consider all triggered pipelines as agent triggers
export const RULE_NEVER_ON_AGENT_TRIGGER: GitlabRule = {
  if: '$CI_PIPELINE_SOURCE  == "trigger"',
  when: "never",
};

export const RULE_NEVER_ON_SCHEDULE: GitlabRule = {
  if: '$CI_PIPELINE_SOURCE  == "schedule"',
  when: "never",
};

export const RULE_IS_MERGE_REQUEST: GitlabRule = {
  if: "$CI_MERGE_REQUEST_ID",
};

export const RULE_IS_TAGGED_RELEASE: GitlabRule = {
  if: "$CI_COMMIT_TAG",
};

export const RULE_CONDITION_HOTFIX_BRANCH =
  "$CI_COMMIT_BRANCH =~ /^[0-9]+.([0-9]+|x).x$/";
