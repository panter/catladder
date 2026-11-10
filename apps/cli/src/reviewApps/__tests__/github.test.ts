import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  githubReviewDeployGuardJob,
  githubReviewStopGuardJob,
} from "../github";

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

  it("trusts a ci dispatch: deploys although the checks api still reports the CI in progress", async () => {
    process.env.CL_DEPLOY_SOURCE = "ci";
    const calls = mockGithub({ status: "in_progress", conclusion: null });
    await githubReviewDeployGuardJob();
    expect(await deployOutput()).toContain("deploy=true");
    expect(calls.some((c) => c.url.startsWith("commits/"))).toBe(false);
    expect(calls.some((c) => c.url.startsWith("statuses/"))).toBe(false);
  });

  it("a ci dispatch for a head the PR moved away from does not deploy", async () => {
    process.env.CL_DEPLOY_SOURCE = "ci";
    process.env.CL_HEAD_SHA = "0000000000000000000000000000000000000000";
    mockGithub({ status: "completed", conclusion: "success" });
    await githubReviewDeployGuardJob();
    expect(await deployOutput()).toContain("deploy=false");
  });
});

describe("review stop guard", () => {
  let file: string;
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    process.env.GITHUB_REPOSITORY = "o/r";
    process.env.GITHUB_TOKEN = "t";
    process.env.CL_PR_NUMBER = "159";
    process.env.GITHUB_EVENT_NAME = "pull_request";
    file = `${process.env.TMPDIR ?? "/tmp"}/gh-stop-${process.pid}-${Math.random()}`;
    process.env.GITHUB_OUTPUT = file;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  const stubFetch = (handler: (path: string) => any) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        handler(url.replace("https://api.github.com/repos/o/r/", "")),
      ),
    );
  const ok = (data: unknown) => ({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => "",
  });
  const pull = (labels: string[]) =>
    ok({
      number: 159,
      state: "open",
      draft: false,
      labels: labels.map((name) => ({ name })),
      head: { sha: HEAD, ref: "feat/x" },
    });
  const out = async () => (await import("fs")).readFileSync(file, "utf8");

  it("stop=true when the label lookup fails with HTTP 500", async () => {
    stubFetch(() => ({ ok: false, status: 500, text: async () => "boom" }));
    await githubReviewStopGuardJob();
    expect(await out()).toContain("stop=true");
  });
  it("stop=false for a PR without marker and without evidence", async () => {
    stubFetch((p) =>
      p.startsWith("pulls/")
        ? pull([])
        : p.includes("/statuses")
          ? ok([])
          : ok({ total_count: 0 }),
    );
    await githubReviewStopGuardJob();
    expect(await out()).toContain("stop=false");
  });
  it("stop=true for a marked PR", async () => {
    stubFetch(() => pull(["catladder:review-deployed"]));
    await githubReviewStopGuardJob();
    expect(await out()).toContain("stop=true");
  });
  it("stop=true for a legacy PR with a review app status", async () => {
    stubFetch((p) =>
      p.startsWith("pulls/")
        ? pull([])
        : ok([{ context: "catladder review app" }]),
    );
    await githubReviewStopGuardJob();
    expect(await out()).toContain("stop=true");
  });
});
