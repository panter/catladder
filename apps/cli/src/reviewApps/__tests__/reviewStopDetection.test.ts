import { describe, expect, it } from "vitest";
import {
  decideReviewStop,
  REVIEW_DEPLOYED_MARKER_LABEL,
} from "../reviewStopDetection";

const pr = "pull_request";
const marked = [REVIEW_DEPLOYED_MARKER_LABEL, "other"];

describe("decideReviewStop", () => {
  it("skips when the PR never attempted a deploy", () => {
    expect(
      decideReviewStop({ event: pr, labels: ["x"], priorDeployEvidence: false })
        .stop,
    ).toBe(false);
  });
  // success, failure, cancelled and still running at close all leave the
  // marker (it is set before any resource is created)
  it.each(["success", "failure", "cancelled", "running at close"])(
    "stops for a deploy that ended as: %s",
    () => {
      expect(decideReviewStop({ event: pr, labels: marked }).stop).toBe(true);
    },
  );
  it("stops when the labels are undeterminable", () => {
    expect(decideReviewStop({ event: pr, labels: undefined }).stop).toBe(true);
  });
  it("always stops on workflow_dispatch, without consulting detection", () => {
    expect(
      decideReviewStop({
        event: "workflow_dispatch",
        labels: [],
        priorDeployEvidence: false,
      }).stop,
    ).toBe(true);
  });
  it("stops on a label-off event of a deployed PR", () => {
    expect(
      decideReviewStop({ event: "pull_request", labels: marked }).stop,
    ).toBe(true);
  });
  it("stops for a legacy PR without marker but with prior deploy evidence", () => {
    expect(
      decideReviewStop({ event: pr, labels: [], priorDeployEvidence: true })
        .stop,
    ).toBe(true);
  });
  it("stops when the legacy evidence lookup failed", () => {
    expect(
      decideReviewStop({
        event: pr,
        labels: [],
        priorDeployEvidence: undefined,
      }).stop,
    ).toBe(true);
  });
});
