import {
  RULE_CONDITION_HOTFIX_BRANCH,
  RULE_CONDITION_MAIN_BRANCH,
  RULE_IS_MERGE_REQUEST,
  RULE_NEVER_ON_AGENT_TRIGGER,
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_SCHEDULE,
} from "../../rules";
import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { getReleaseMethod } from "../../release";
import type { Config } from "../../types/config";
import type { GitlabRule } from "../../types";

const EXPIRED_TOKEN_HELP =
  "echo '👉 If this job failed with access denied, the project access token might be invald - run `project-renew-token` in catladder CLI to fix.'";

const baseReleaseRules = [
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_AGENT_TRIGGER,
  RULE_NEVER_ON_SCHEDULE,
];
export const getGitlabReleaseJobs = (config: Config, images: JobImagesPlan) => {
  const method = getReleaseMethod(config);
  // NOTE: only the resolved image url is used, not the `need`: release
  // jobs have no `needs` on purpose — their stage ordering already
  // guarantees the image build job (setup stage) ran, and adding a
  // `needs` would switch gitlab to DAG mode, so the release job would no
  // longer wait for the build/deploy stages.
  const releaseImage = images.resolveRef({
    catladderImage: method.image,
  }).image;
  return {
    ["create release"]: {
      stage: "release",
      image: releaseImage,
      script: [method.script],
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
      image: releaseImage,
      script: [method.script],
      after_script: [EXPIRED_TOKEN_HELP],
      needs: [],
      // force semantics of the method's script (e.g. changesets:
      // release a patch bump even without pending changesets)
      ...(method.forceReleaseVariables
        ? { variables: method.forceReleaseVariables }
        : {}),
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
    // informational MR check of the release method (e.g. the changeset
    // check): warns via allow_failure, the report lands in the MR
    // widget as an exposed artifact
    ...(method.checkScript
      ? {
          ["🦋 changeset check"]: {
            stage: "test",
            image: releaseImage,
            script: [method.checkScript],
            allow_failure: true,
            artifacts: {
              paths: ["changeset-report.md"],
              expose_as: "changeset report",
              // the report must survive the warning exit
              when: "always" as const,
            },
            rules: [
              RULE_NEVER_ON_AGENT_TRIGGER,
              RULE_NEVER_ON_SCHEDULE,
              RULE_IS_MERGE_REQUEST,
            ] satisfies GitlabRule[],
          },
        }
      : {}),
  };
};
