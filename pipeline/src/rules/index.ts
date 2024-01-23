import type { GitlabRule } from "../types";

export const RULE_NEVER_ON_RELEASE_COMMIT: GitlabRule = {
  if: "$CI_COMMIT_MESSAGE =~ /^chore\\(release\\).*/",
  when: "never",
};

export const RULE_NEVER_ON_SCHEDULE: GitlabRule = {
  if: '$CI_PIPELINE_SOURCE  == "schedule"',
  when: "never",
};

export const RULES_ALWAYS: GitlabRule[] = [
  {
    if: "$CI_COMMIT_TAG",
  },
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_SCHEDULE,
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

export const RULE_CONDITION_HOTFIX_BRANCH =
  "$CI_COMMIT_BRANCH =~ /^[0-9]+.([0-9]+|x).x$/";

export const RULES_RELEASE: GitlabRule[] = [
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_SCHEDULE,
  {
    if: RULE_CONDITION_MAIN_BRANCH + ' && $AUTO_RELEASE == "true"',
    when: "on_success",
  },
  {
    if: RULE_CONDITION_MAIN_BRANCH,
    when: "manual",
  },
  {
    if: RULE_CONDITION_HOTFIX_BRANCH,
    when: "manual",
  },
];

export const RULES_MANUAL_RELEASE: GitlabRule[] = [
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_SCHEDULE,
  {
    if: RULE_CONDITION_MAIN_BRANCH,
    when: "manual",
  },
  {
    if: RULE_CONDITION_HOTFIX_BRANCH,
    when: "manual",
  },
];
