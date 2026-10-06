import type { AllCatladderJobs } from "../../pipeline/createAllJobs";
import {
  getGitlabLabelRegex,
  GITLAB_DRAFT_MR_CONDITION,
  isReviewDeliveryJob,
  isReviewDeployGated,
  type ResolvedReviewAppsConfig,
} from "../../reviewApps";
import {
  RULE_IS_MERGE_REQUEST,
  RULE_NEVER_ON_AGENT_TRIGGER,
} from "../../rules";
import type { GitlabJobDef, GitlabRule } from "../../types";
import { DEFAULT_PIPELINE_IMAGE } from "./createGitlabPipeline";

export const REVIEW_DEPLOY_GATE_JOB_NAME = "🚀 deploy review";

/**
 * the review deploy switch of a merge request (see reviewApps.ts): ONE
 * job per MR pipeline that unlocks the delivery chains (docker → deploy
 * → verify) of all components' review apps, instead of a manual job per
 * component — or a docker build per component in every pipeline.
 *
 * The chain heads `needs` the switch. It is a no-op job with
 * `allow_failure: true`: while it is unplayed, gitlab marks its
 * dependents skipped and the pipeline still passes ("Pipelines must
 * succeed" keeps working); playing it resets them to created, so it
 * can be played any time — early clicks wait for the builds and tests
 * like the chains always did (the same mechanism as the release
 * button).
 *
 * The label/draft policy decides whether it starts on its own. Label
 * changes only apply to the next pipeline (gitlab doesn't start one for
 * them) — `catladder mr review-app-on` sets the label and triggers one.
 *
 * Mutates the needs of the gated jobs; returns the switch job, or
 * nothing when review deploys aren't gated (or nothing deploys).
 */
export const addGitlabReviewDeployGate = (
  allJobs: AllCatladderJobs,
  reviewApps: ResolvedReviewAppsConfig,
): GitlabJobDef | undefined => {
  if (!isReviewDeployGated(reviewApps)) {
    return undefined;
  }
  let gated = false;
  for (const { context, jobs } of allJobs.components) {
    for (const job of jobs) {
      // the chain heads: verify follows its deploy anyway
      if (isReviewDeliveryJob(context, job) && job.stage !== "verify") {
        job.needs = [
          ...(job.needs ?? []),
          { job: REVIEW_DEPLOY_GATE_JOB_NAME, artifacts: false, global: true },
        ];
        gated = true;
      }
    }
  }
  if (!gated) {
    return undefined;
  }

  const isMr = RULE_IS_MERGE_REQUEST.if;
  const manual = { when: "manual", allow_failure: true } as const;
  const auto = { when: "on_success" } as const;
  const policyRules: GitlabRule[] =
    reviewApps.deploy === "optIn"
      ? [
          {
            if: `${isMr} && $CI_MERGE_REQUEST_LABELS =~ ${getGitlabLabelRegex(reviewApps.label)}`,
            ...auto,
          },
          { if: isMr, ...manual },
        ]
      : reviewApps.deploy === "optOut"
        ? [
            {
              if: `${isMr} && $CI_MERGE_REQUEST_LABELS =~ ${getGitlabLabelRegex(reviewApps.skipLabel)}`,
              ...manual,
            },
            { if: isMr, ...auto },
          ]
        : reviewApps.deploy === "manual"
          ? [{ if: isMr, ...manual }]
          : [{ if: isMr, ...auto }];

  return {
    stage: "setup",
    image: DEFAULT_PIPELINE_IMAGE,
    variables: { GIT_STRATEGY: "none" },
    needs: [],
    interruptible: true,
    allow_failure: true,
    script: [
      `echo "review apps unlocked — the docker → deploy → verify chains of all components run as soon as their builds and tests succeeded"`,
    ],
    rules: [
      RULE_NEVER_ON_AGENT_TRIGGER,
      // drafts never deploy on their own (drafts: "none" has no
      // pipeline at all, see the workflow rules)
      ...(reviewApps.drafts !== "full"
        ? [{ if: `${isMr} && ${GITLAB_DRAFT_MR_CONDITION}`, ...manual }]
        : []),
      ...policyRules,
    ],
  };
};
