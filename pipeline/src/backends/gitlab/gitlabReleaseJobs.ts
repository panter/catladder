import {
  RULE_CONDITION_HOTFIX_BRANCH,
  RULE_CONDITION_MAIN_BRANCH,
  RULE_NEVER_ON_AGENT_TRIGGER,
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_SCHEDULE,
} from "../../rules";
import { getRunnerImage } from "../../runner";
import type { Config } from "../../types/config";
import type { GitlabRule } from "../../types";

const EXPIRED_TOKEN_HELP =
  "echo '👉 If this job failed with access denied, the project access token might be invald - run `project-renew-token` in catladder CLI to fix.'";

const baseReleaseRules = [
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_AGENT_TRIGGER,
  RULE_NEVER_ON_SCHEDULE,
];
export const getGitlabReleaseJobs = (config: Config) => {
  return {
    ["create release"]: {
      stage: "release",
      image: getRunnerImage("semantic-release"),
      script: ["semanticRelease"],
      after_script: [EXPIRED_TOKEN_HELP],
      rules: [
        ...baseReleaseRules,
        {
          if: RULE_CONDITION_MAIN_BRANCH,
          when: config.releases?.when === "auto" ? "on_success" : "manual",
        },
        {
          if: RULE_CONDITION_HOTFIX_BRANCH,
          when: "manual",
        },
      ] satisfies GitlabRule[],
    },
    ["⚠️ force create release"]: {
      stage: "release",
      image: getRunnerImage("semantic-release"),
      script: ["semanticRelease"],
      after_script: [EXPIRED_TOKEN_HELP],
      needs: [],
      rules: [
        ...baseReleaseRules,
        {
          if: RULE_CONDITION_MAIN_BRANCH,
          when: "manual",
        },
        {
          if: RULE_CONDITION_HOTFIX_BRANCH,
          when: "manual",
        },
      ] satisfies GitlabRule[],
    },
  };
};
