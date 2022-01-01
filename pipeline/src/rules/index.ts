import { GitlabRule } from "../types";

export const RULES_ALWAYS: GitlabRule[] = [
  { if: "$CI_COMMIT_TAG" },
  {
    if: "$CI_COMMIT_MESSAGE =~ /^chore(release).*/",
    when: "never",
  },
  { if: "$CI_COMMIT_BRANCH =~ /^[0-9]+.([0-9]+|x).x$/" },
  {
    if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH",
  },

  { if: "$CI_MERGE_REQUEST_ID" },
];
