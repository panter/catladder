import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { githubQueuedGuardJob } from "../githubQueuedRelease";

const MARKER = "refs/catladder/release-queued";
const MAIN = "refs/heads/main";

/**
 * a fake origin: remote refs plus the github api state the guard reads
 * (main workflow runs per sha, ancestry)
 */
const remote = vi.hoisted(() => ({
  refs: new Map<string, string>(),
  runs: new Map<string, { status: string; conclusion: string | null }>(),
  ancestors: new Set<string>(),
  /** runs right before a lease check, to simulate a racing guard */
  beforePush: undefined as undefined | (() => void),
}));

vi.mock("../releaseGit", () => ({
  git: vi.fn(async (command: string, ...args: string[]) => {
    if (command === "ls-remote") {
      const sha = remote.refs.get(args[1]);
      return sha ? `${sha}\t${args[1]}` : "";
    }
    if (command === "push") {
      remote.beforePush?.();
      const lease = args.find((arg) => arg.startsWith("--force-with-lease="));
      const refspec = args[args.length - 1];
      const [src, dst] = refspec.replace(/^\+/, "").split(":");
      if (lease) {
        const [ref, expected] = lease
          .slice("--force-with-lease=".length)
          .split(":");
        if ((remote.refs.get(ref) ?? "") !== expected) {
          throw new Error("stale info");
        }
      }
      if (src) remote.refs.set(dst, src);
      else remote.refs.delete(dst);
      return "";
    }
    return "";
  }),
}));

let workDir: string;
let outputFile: string;

const output = async () => {
  const content = await readFile(outputFile, "utf-8");
  return Object.fromEntries(
    content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("=")),
  );
};

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "queued-guard-"));
  outputFile = join(workDir, "output");
  await writeFile(outputFile, "");
  remote.refs.clear();
  remote.runs.clear();
  remote.ancestors.clear();
  remote.beforePush = undefined;
  vi.stubEnv("GITHUB_OUTPUT", outputFile);
  vi.stubEnv("GITHUB_STEP_SUMMARY", join(workDir, "summary"));
  vi.stubEnv("GITHUB_REPOSITORY", "acme/app");
  vi.stubEnv("GITHUB_TOKEN", "token");
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`exit ${code}`);
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const compare = /\/compare\/(\w+)\.\.\.(\w+)$/.exec(url);
      if (compare) {
        return Response.json({
          status: remote.ancestors.has(`${compare[1]}..${compare[2]}`)
            ? "ahead"
            : "diverged",
        });
      }
      const sha = /head_sha=(\w+)/.exec(url)?.[1] ?? "";
      const run = remote.runs.get(sha);
      return Response.json({ workflow_runs: run ? [run] : [] });
    }),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await rm(workDir, { recursive: true, force: true });
});

describe("githubQueuedGuardJob", () => {
  it("does nothing without a queued release", async () => {
    await githubQueuedGuardJob("aaa", "success");
    expect(await output()).toEqual({ release: "false" });
  });

  it("leaves a release queued for another commit alone", async () => {
    remote.refs.set(MARKER, "bbb");
    await githubQueuedGuardJob("aaa", "success");
    expect(await output()).toEqual({ release: "false" });
    expect(remote.refs.get(MARKER)).toBe("bbb");
  });

  it("consumes the marker and releases for a green run", async () => {
    remote.refs.set(MARKER, "aaa");
    await githubQueuedGuardJob("aaa", "success");
    expect(await output()).toEqual({ release: "true" });
    expect(remote.refs.has(MARKER)).toBe(false);
  });

  it("consumes the marker and fails for a red run", async () => {
    remote.refs.set(MARKER, "aaa");
    await expect(githubQueuedGuardJob("aaa", "failure")).rejects.toThrow(
      "exit 1",
    );
    expect(remote.refs.has(MARKER)).toBe(false);
  });

  it("does not release when another guard consumed the marker first", async () => {
    remote.refs.set(MARKER, "aaa");
    remote.beforePush = () => remote.refs.delete(MARKER);
    await githubQueuedGuardJob("aaa", "success");
    expect(await output()).toEqual({ release: "false" });
  });

  describe("cancelled run", () => {
    beforeEach(() => {
      remote.refs.set(MARKER, "aaa");
      remote.refs.set(MAIN, "ccc");
      remote.ancestors.add("aaa..ccc");
    });

    it("moves the release to the newer main head while its run is running", async () => {
      remote.runs.set("ccc", { status: "in_progress", conclusion: null });
      await githubQueuedGuardJob("aaa", "cancelled");
      expect(await output()).toEqual({ release: "false" });
      expect(remote.refs.get(MARKER)).toBe("ccc");
    });

    it("releases when the newer head's run already succeeded", async () => {
      remote.runs.set("ccc", { status: "completed", conclusion: "success" });
      await githubQueuedGuardJob("aaa", "cancelled");
      expect(await output()).toEqual({ release: "true" });
      expect(remote.refs.has(MARKER)).toBe(false);
    });

    it("fails when the newer head's run already failed", async () => {
      remote.runs.set("ccc", { status: "completed", conclusion: "failure" });
      await expect(githubQueuedGuardJob("aaa", "cancelled")).rejects.toThrow(
        "exit 1",
      );
      expect(remote.refs.has(MARKER)).toBe(false);
    });

    it("releases right away when the newer head has no main run", async () => {
      await githubQueuedGuardJob("aaa", "cancelled");
      expect(await output()).toEqual({ release: "true" });
      expect(remote.refs.has(MARKER)).toBe(false);
    });

    it("releases only once when the newer head's guard races", async () => {
      remote.runs.set("ccc", { status: "completed", conclusion: "success" });
      // the newer run's guard consumes the moved marker first
      let pushes = 0;
      remote.beforePush = () => {
        pushes += 1;
        if (pushes === 2) remote.refs.delete(MARKER);
      };
      await githubQueuedGuardJob("aaa", "cancelled");
      expect(await output()).toEqual({ release: "false" });
    });

    it("drops the release when main did not move on (cancelled by hand)", async () => {
      remote.refs.set(MAIN, "aaa");
      await expect(githubQueuedGuardJob("aaa", "cancelled")).rejects.toThrow(
        "exit 1",
      );
      expect(remote.refs.has(MARKER)).toBe(false);
    });

    it("drops the release when main does not contain the queued commit", async () => {
      remote.ancestors.clear();
      await expect(githubQueuedGuardJob("aaa", "cancelled")).rejects.toThrow(
        "exit 1",
      );
      expect(remote.refs.has(MARKER)).toBe(false);
    });
  });
});
