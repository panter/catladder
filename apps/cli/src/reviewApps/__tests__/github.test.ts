import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { githubReviewDeployGuardJob } from "../github";

const HEAD = "4a60abe0000000000000000000000000000000aa";

type Call = { url: string; method: string; body?: any };

/** a github api double: one PR, a `catladder ✅` check in a given state */
const mockGithub = (
  check: { status: string; conclusion: string | null } | null,
) => {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: any = {}) => {
      const path = url.replace("https://api.github.com/repos/o/r/", "");
      calls.push({
        url: path,
        method: init.method ?? "GET",
        body: init.body ? JSON.parse(init.body) : undefined,
      });
      const json = (data: unknown) => ({
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
      });
      if (path.startsWith("pulls/")) {
        return json({
          number: 159,
          state: "open",
          draft: false,
          labels: [{ name: "catladder:review-app" }],
          head: { sha: HEAD, ref: "feat/x" },
        });
      }
      if (path.startsWith("commits/")) {
        return json({ check_runs: check ? [{ id: 1, ...check }] : [] });
      }
      return json({});
    }),
  );
  return calls;
};

describe("review deploy guard: label added while the CI runs", () => {
  let output: string;
  beforeEach(() => {
    output = "";
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.GITHUB_REPOSITORY = "o/r";
    process.env.GITHUB_TOKEN = "t";
    process.env.GITHUB_RUN_ID = "1";
    process.env.CL_PR_NUMBER = "159";
    process.env.CL_HEAD_SHA = HEAD;
    process.env.CL_DEPLOY_SOURCE = "label";
    process.env.CL_REVIEW_APPS = JSON.stringify({
      deploy: "optIn",
      label: "catladder:review-app",
      skipLabel: "catladder:no-review-app",
      drafts: "likeReady",
    });
    // capture the step output
    const file = `${process.env.TMPDIR ?? "/tmp"}/gh-output-${process.pid}-${Math.random()}`;
    process.env.GITHUB_OUTPUT = file;
    output = file;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const deployOutput = async () =>
    (await import("fs")).readFileSync(output, "utf8");

  it("defers and reports a pending status while the CI is not finished", async () => {
    const calls = mockGithub({ status: "in_progress", conclusion: null });
    await githubReviewDeployGuardJob();
    expect(await deployOutput()).toContain("deploy=false");
    const status = calls.find((c) => c.url === `statuses/${HEAD}`);
    expect(status?.method).toBe("POST");
    expect(status?.body).toMatchObject({
      state: "pending",
      context: "catladder review app",
    });
    expect(status?.body.description).toContain("waiting for the CI");
  });

  it("defers and reports pending while the CI has not even reported", async () => {
    const calls = mockGithub(null);
    await githubReviewDeployGuardJob();
    expect(await deployOutput()).toContain("deploy=false");
    expect(calls.some((c) => c.url === `statuses/${HEAD}`)).toBe(true);
  });

  it("deploys without a pending status when the CI already finished green", async () => {
    const calls = mockGithub({ status: "completed", conclusion: "success" });
    await githubReviewDeployGuardJob();
    expect(await deployOutput()).toContain("deploy=true");
    expect(calls.some((c) => c.url.startsWith("statuses/"))).toBe(false);
  });
});
