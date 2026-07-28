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
import type { GitlabJobDef, GitlabRule } from "../../types";

const EXPIRED_TOKEN_HELP =
  "echo '👉 If this job failed with access denied, the project access token might be invald - run `project-renew-token` in catladder CLI to fix.'";

/**
 * gitlab rejects jobs with more than 50 `needs:` entries (default
 * limit). Pipelines beyond that fall back to the legacy manual release
 * job, which is only playable once all prior stages finished.
 */
const GITLAB_MAX_NEEDS = 50;

export const RELEASE_BUTTON_JOB_NAME = "create release";
export const RELEASE_EXECUTOR_JOB_NAME = "🚀 release once pipeline succeeds";

const baseReleaseRules = [
  RULE_NEVER_ON_RELEASE_COMMIT,
  RULE_NEVER_ON_AGENT_TRIGGER,
  RULE_NEVER_ON_SCHEDULE,
];

const manualReleaseRules = [
  ...baseReleaseRules,
  {
    if: RULE_CONDITION_MAIN_BRANCH,
    when: "manual",
  },
  {
    if: RULE_CONDITION_HOTFIX_BRANCH,
    when: "manual",
  },
] satisfies GitlabRule[];

export const getGitlabReleaseJobs = (
  config: Config,
  images: JobImagesPlan,
  /**
   * names of the jobs that run automatically in main-branch pipelines
   * (manual jobs excluded: a needed-but-unplayed manual job would make
   * gitlab skip the release executor)
   */
  mainBranchJobNames: string[],
) => {
  const method = getReleaseMethod(config);
  // NOTE: only the resolved image url is used, not the `need`: release
  // jobs have no `needs` on the whole pipeline on purpose — where they
  // must wait for it, the wait is expressed by enumerating the jobs
  // explicitly (see the executor below).
  const releaseImage = images.resolveRef({
    catladderImage: method.image,
  }).image;

  const releaseJobBase = {
    stage: "release",
    image: releaseImage,
    script: [method.script],
    after_script: [EXPIRED_TOKEN_HELP],
  } satisfies GitlabJobDef;

  const forceReleaseJob = {
    ["⚠️ force create release"]: {
      ...releaseJobBase,
      needs: [],
      // force semantics of the method's script (e.g. changesets:
      // release a patch bump even without pending changesets)
      ...(method.forceReleaseVariables
        ? { variables: method.forceReleaseVariables }
        : {}),
      rules: manualReleaseRules,
    } satisfies GitlabJobDef,
  };

  // informational MR check of the release method (e.g. the changeset
  // check): warns via allow_failure, the report lands in the MR
  // widget as an exposed artifact
  const checkJob = method.checkScript
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
        } satisfies GitlabJobDef,
      }
    : {};

  if (config.releases?.when === "auto") {
    return {
      [RELEASE_BUTTON_JOB_NAME]: {
        ...releaseJobBase,
        rules: [
          ...baseReleaseRules,
          {
            if: RULE_CONDITION_MAIN_BRANCH,
            when: "on_success",
          },
          {
            if: RULE_CONDITION_HOTFIX_BRANCH,
            when: "manual",
          },
        ] satisfies GitlabRule[],
      } satisfies GitlabJobDef,
      ...forceReleaseJob,
      ...checkJob,
    };
  }

  const executorNeeds = [
    { job: RELEASE_BUTTON_JOB_NAME },
    // optional: hotfix pipelines (and rules-filtered jobs) contain a
    // different job subset
    ...mainBranchJobNames.map((name) => ({ job: name, optional: true })),
  ];

  if (executorNeeds.length > GITLAB_MAX_NEEDS) {
    console.warn(
      `⚠️ the main-branch pipeline has more than ${GITLAB_MAX_NEEDS} jobs — ` +
        `the "${RELEASE_BUTTON_JOB_NAME}" job falls back to being playable ` +
        `only once the pipeline finished (gitlab caps needs: at ${GITLAB_MAX_NEEDS})`,
    );
    return {
      [RELEASE_BUTTON_JOB_NAME]: {
        ...releaseJobBase,
        rules: manualReleaseRules,
      } satisfies GitlabJobDef,
      ...forceReleaseJob,
      ...checkJob,
    };
  }

  return {
    // the queue button: playable from the first second of the pipeline.
    // It only records the intent to release — the executor below does
    // the actual work once every other job succeeded. Clicking after the
    // pipeline finished works the same (the executor starts right away).
    [RELEASE_BUTTON_JOB_NAME]: {
      stage: "release",
      image: releaseImage,
      script: [
        `echo "release queued — '${RELEASE_EXECUTOR_JOB_NAME}' runs it as soon as every other job in this pipeline succeeded"`,
      ],
      needs: [],
      // allow_failure keeps the unclicked button from blocking the
      // pipeline AND makes the executor's needs treat it as optional
      // (skipped executor instead of a forever-waiting pipeline)
      allow_failure: true,
      rules: manualReleaseRules,
    } satisfies GitlabJobDef,
    // the executor: never played manually. Skipped when the button was
    // not clicked; otherwise starts automatically as soon as the button
    // and every other (non-manual) job of the pipeline succeeded, and
    // is skipped when any of them failed.
    [RELEASE_EXECUTOR_JOB_NAME]: {
      ...releaseJobBase,
      needs: executorNeeds,
      rules: [
        ...baseReleaseRules,
        {
          if: RULE_CONDITION_MAIN_BRANCH,
          when: "on_success",
        },
        {
          if: RULE_CONDITION_HOTFIX_BRANCH,
          when: "on_success",
        },
      ] satisfies GitlabRule[],
    } satisfies GitlabJobDef,
    ...forceReleaseJob,
    ...checkJob,
  };
};
