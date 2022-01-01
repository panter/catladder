import { GitlabRule } from "../types";

const NEVER_ON_RELEASE_COMMIT: GitlabRule = {
  if: "$CI_COMMIT_MESSAGE =~ /^chore(release).*/",
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

export const RULES_RELEASE: GitlabRule[] = [
  NEVER_ON_RELEASE_COMMIT,
  {
    if: '$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH && $AUTO_RELEASE == "true"',
    when: "on_success",
  },
  {
    if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH",
    when: "manual",
  },
  {
    if: "$CI_COMMIT_BRANCH =~ /^[0-9]+.([0-9]+|x).x$/", // hotfix branches
    when: "manual",
  },
];
