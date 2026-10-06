import { getPinLabelRegexSource } from "./autoStop";
import {
  DEFAULT_NO_REVIEW_APP_LABEL,
  DEFAULT_REVIEW_APP_LABEL,
  type ResolvedReviewAppsConfig,
} from "./reviewAppsPolicy";
import type { Config } from "./types";
import type { Context } from "./types/context";
import type { CatladderJob } from "./types/jobs";

export * from "./reviewAppsPolicy";

export const getReviewAppsConfig = (
  config: Config,
): ResolvedReviewAppsConfig => ({
  deploy: config.reviewApps?.deploy ?? "auto",
  // single colon on purpose: gitlab treats `a::b` labels as scoped and
  // mutually exclusive, which would make this label and the
  // `catladder::pin-review` pin label displace each other
  label: config.reviewApps?.label ?? DEFAULT_REVIEW_APP_LABEL,
  skipLabel: config.reviewApps?.skipLabel ?? DEFAULT_NO_REVIEW_APP_LABEL,
  drafts: config.reviewApps?.drafts ?? "full",
});

/**
 * whether the review deploys sit behind the per-MR/PR deploy switch
 * instead of running in every pipeline
 */
export const isReviewDeployGated = (config: ResolvedReviewAppsConfig) =>
  config.deploy !== "auto" || config.drafts === "ci";

/**
 * the label whose change switches the review apps on (`labeled` on
 * opt-in, `unlabeled` on opt-out) or off (the inverse), if the mode is
 * label-driven at all
 */
export const getReviewAppsSwitchLabel = (
  config: ResolvedReviewAppsConfig,
):
  | { label: string; deployOn: "labeled" | "unlabeled"; stopOn: string }
  | undefined => {
  switch (config.deploy) {
    case "optIn":
      return { label: config.label, deployOn: "labeled", stopOn: "unlabeled" };
    case "optOut":
      return {
        label: config.skipLabel,
        deployOn: "unlabeled",
        stopOn: "labeled",
      };
    default:
      return undefined;
  }
};

/**
 * gitlab: matches a label inside `$CI_MERGE_REQUEST_LABELS`
 * (comma-separated) — anchored so `x` never matches `no-x`
 */
export const getGitlabLabelRegex = (label: string): string =>
  `/${getPinLabelRegexSource(label)}/`;

/**
 * gitlab: a draft MR, by its title prefix — the only draft signal every
 * gitlab version exposes to rules
 */
export const GITLAB_DRAFT_MR_CONDITION =
  "$CI_MERGE_REQUEST_TITLE =~ /^\\s*(\\[draft\\]|\\(draft\\)|draft:)/i";

/**
 * whether a job belongs to the delivery chain of a review app — the
 * docker image, the deploy and the post-deploy verification. These jobs
 * sit behind the review deploy switch; quality jobs (lint, test, audit)
 * and the app build never do.
 */
export const isReviewDeliveryJob = (context: Context, job: CatladderJob) =>
  context.type === "component" &&
  context.environment.instance.type === "review" &&
  (job.stage === "deploy" ||
    job.stage === "verify" ||
    (job.provides ?? []).includes("dockerImage"));
