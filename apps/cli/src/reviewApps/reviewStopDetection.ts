/**
 * decides whether the review-stop workflow has anything to stop: a PR
 * that never attempted a review deploy has no review apps, so the
 * (expensive) stop jobs can be skipped.
 *
 * Fail open: whenever it is unclear whether a deploy happened, stop.
 */

/**
 * the PR label the deploy side sets before it creates any resource.
 * Keep in sync with the marker job in
 * packages/pipeline/src/backends/github/reviewDeployWorkflow.ts.
 */
export const REVIEW_DEPLOYED_MARKER_LABEL = "catladder:review-deployed";

export type StopDecision = { stop: boolean; reason: string };

export type StopDetectionInput = {
  event: "pull_request" | "workflow_dispatch" | string;
  /** the PR's labels; undefined = the lookup failed / unknown */
  labels: string[] | undefined;
  /**
   * legacy PRs (deployed before the marker existed) carry no label: true
   * when a catladder review app commit status or review run exists for
   * the PR; undefined = unknown (lookup failed)
   */
  priorDeployEvidence?: boolean;
};

export const decideReviewStop = ({
  event,
  labels,
  priorDeployEvidence,
}: StopDetectionInput): StopDecision => {
  if (event === "workflow_dispatch") {
    return { stop: true, reason: "explicit dispatch always stops" };
  }
  if (labels === undefined) {
    return {
      stop: true,
      reason: "could not read the PR labels, assuming a deploy happened",
    };
  }
  if (labels.includes(REVIEW_DEPLOYED_MARKER_LABEL)) {
    return { stop: true, reason: "the PR has deployed review apps" };
  }
  if (priorDeployEvidence === undefined) {
    return {
      stop: true,
      reason: "could not look up earlier review deploys, assuming one happened",
    };
  }
  if (priorDeployEvidence) {
    return {
      stop: true,
      reason: "no marker, but an earlier review deploy was found (legacy PR)",
    };
  }
  return { stop: false, reason: "the PR never attempted a review deploy" };
};
