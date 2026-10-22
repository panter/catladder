/**
 * the review-app deploy policy — dependency-free, so catci (the CI
 * companion bundle) can import it without dragging in the pipeline.
 */
/**
 * when the review apps of a merge request / pull request deploy:
 * - auto: every MR/PR deploys its review apps (default)
 * - manual: never on their own — one "deploy review" switch per MR/PR
 *   (gitlab: a manual job in the pipeline, github: a dispatch workflow)
 * - optIn: only while the MR/PR carries the `label`
 * - optOut: unless the MR/PR carries the `skipLabel`
 */
export type ReviewAppsDeployMode = "auto" | "manual" | "optIn" | "optOut";

/**
 * what a draft MR/PR runs:
 * - likeReady: the same as a ready one, review apps included (default)
 * - checksOnly: tests, lint and audit only — the review apps deploy once it is
 *   marked ready
 * - skip: no pipeline at all
 */
export type ReviewAppsDraftsMode = "likeReady" | "checksOnly" | "skip";

export const DEFAULT_REVIEW_APP_LABEL = "catladder:review-app";
export const DEFAULT_NO_REVIEW_APP_LABEL = "catladder:no-review-app";

export type ResolvedReviewAppsConfig = {
  deploy: ReviewAppsDeployMode;
  label: string;
  skipLabel: string;
  drafts: ReviewAppsDraftsMode;
};

/**
 * the state of a merge request / pull request the deploy decision
 * depends on
 */
export type ReviewAppsMrState = {
  labels: string[];
  draft: boolean;
};

/**
 * whether the review apps of an MR/PR in the given state deploy
 * automatically. An explicit request (playing the gate job, dispatching
 * the deploy workflow) always deploys and doesn't consult this.
 */
export const shouldAutoDeployReviewApps = (
  config: ResolvedReviewAppsConfig,
  { labels, draft }: ReviewAppsMrState,
): { deploy: boolean; reason: string } => {
  if (draft && config.drafts !== "likeReady") {
    return { deploy: false, reason: "drafts don't deploy review apps" };
  }
  switch (config.deploy) {
    case "auto":
      return { deploy: true, reason: "review apps deploy automatically" };
    case "manual":
      return {
        deploy: false,
        reason: "review apps only deploy on request (deploy: manual)",
      };
    case "optIn":
      return labels.includes(config.label)
        ? { deploy: true, reason: `the '${config.label}' label is set` }
        : { deploy: false, reason: `the '${config.label}' label is not set` };
    case "optOut":
      return labels.includes(config.skipLabel)
        ? { deploy: false, reason: `the '${config.skipLabel}' label is set` }
        : {
            deploy: true,
            reason: `the '${config.skipLabel}' label is not set`,
          };
  }
};
