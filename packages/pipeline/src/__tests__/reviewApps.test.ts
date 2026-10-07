import { describe, expect, it } from "vitest";
import { getGitlabCompletePipeline } from "..";
import {
  getReviewAppsConfig,
  isReviewDeployGated,
  shouldAutoDeployReviewApps,
} from "../reviewApps";
import type { Config } from "../types";

const resolved = (reviewApps: Config["reviewApps"]) =>
  getReviewAppsConfig({ reviewApps } as Config);

describe("review apps policy", () => {
  it("defaults to deploying every MR, drafts included", () => {
    const config = resolved(undefined);
    expect(isReviewDeployGated(config)).toBe(false);
    expect(
      shouldAutoDeployReviewApps(config, { labels: [], draft: true }).deploy,
    ).toBe(true);
  });

  it.each([
    ["optIn", ["catladder:review-app"], true],
    ["optIn", ["other"], false],
    ["optOut", [], true],
    ["optOut", ["catladder:no-review-app"], false],
    ["manual", ["catladder:review-app"], false],
  ] as const)("%s with labels %j deploys: %s", (deploy, labels, expected) => {
    expect(
      shouldAutoDeployReviewApps(resolved({ deploy }), {
        labels: [...labels],
        draft: false,
      }).deploy,
    ).toBe(expected);
  });

  it("drafts other than likeReady never deploy on their own", () => {
    for (const drafts of ["checksOnly", "skip"] as const) {
      expect(
        shouldAutoDeployReviewApps(resolved({ deploy: "optOut", drafts }), {
          labels: [],
          draft: true,
        }).deploy,
      ).toBe(false);
    }
  });

  it("drafts: checksOnly gates even the auto mode", () => {
    expect(isReviewDeployGated(resolved({ drafts: "checksOnly" }))).toBe(true);
    expect(isReviewDeployGated(resolved({ drafts: "skip" }))).toBe(false);
  });
});

const gitlabConfig = (reviewApps: Config["reviewApps"]) =>
  ({
    appName: "test-app",
    customerName: "pan",
    reviewApps,
    store: {
      gcloudProjects: { "some-project": { projectNumber: "123456789012" } },
    },
    components: {
      api: {
        dir: "api",
        build: { type: "node" },
        deploy: {
          type: "google-cloudrun",
          projectId: "some-project",
          region: "europe-west6",
        },
      },
    },
  }) as unknown as Config;

type GitlabJob = {
  needs?: Array<string | { job: string }>;
  rules?: Array<{ if?: string; when?: string }>;
  allow_failure?: boolean;
};

const gitlabJobs = async (reviewApps: Config["reviewApps"]) =>
  (await getGitlabCompletePipeline(gitlabConfig(reviewApps))) as Record<
    string,
    GitlabJob
  > & { workflow: { rules: Array<{ if?: string; when?: string }> } };

const needNames = (job: GitlabJob) =>
  (job.needs ?? []).map((need) => (typeof need === "string" ? need : need.job));

describe("gitlab review deploy switch", () => {
  it("is absent by default", async () => {
    const jobs = await gitlabJobs(undefined);
    expect(jobs["🚀 deploy review"]).toBeUndefined();
  });

  it("gates the docker build and the deploy, not the tests", async () => {
    const jobs = await gitlabJobs({ deploy: "optIn" });
    expect(jobs["🚀 deploy review"]).toMatchObject({
      allow_failure: true,
      needs: [],
    });
    expect(needNames(jobs["api 🔨 docker | review "])).toContain(
      "🚀 deploy review",
    );
    expect(needNames(jobs["api 🚀 Deploy | review "])).toContain(
      "🚀 deploy review",
    );
    expect(needNames(jobs["api 🧪 test | review "])).not.toContain(
      "🚀 deploy review",
    );
    // the deploy follows the switch on its own
    expect(
      jobs["api 🚀 Deploy | review "].rules?.some(
        (rule) => rule.when === "manual",
      ),
    ).toBe(false);
  });

  it("opt-in: the label starts the switch, otherwise it waits", async () => {
    const { rules } = (await gitlabJobs({ deploy: "optIn" }))[
      "🚀 deploy review"
    ];
    expect(rules).toContainEqual({
      if: "$CI_MERGE_REQUEST_ID && $CI_MERGE_REQUEST_LABELS =~ /(^|,)catladder:review-app(,|$)/",
      when: "on_success",
    });
    expect(rules?.at(-1)).toMatchObject({
      if: "$CI_MERGE_REQUEST_ID",
      when: "manual",
    });
  });

  it("drafts: skip drops draft MR pipelines", async () => {
    const pipeline = await gitlabJobs({ drafts: "skip" });
    expect(pipeline.workflow.rules[1]).toMatchObject({ when: "never" });
    expect(pipeline.workflow.rules[1].if).toContain("$CI_MERGE_REQUEST_TITLE");
    expect(pipeline["🚀 deploy review"]).toBeUndefined();
  });
});
