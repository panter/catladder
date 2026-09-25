import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHANGESET_REPORT_FILE, changesetCheckJob } from "../changesetCheckJob";

// the merge request's diff against its target branch: the only git
// output the check parses
const gitMock = vi.hoisted(() => ({ addedFiles: [] as string[] }));

vi.mock("../releaseGit", () => ({
  ensureReleaseHistory: vi.fn(async () => undefined),
  getLastReleaseTag: vi.fn(async () => "v1.2.3"),
  git: vi.fn(async (command: string) =>
    command === "diff" ? gitMock.addedFiles.join("\n") : "",
  ),
}));

vi.mock("../changesetsReleaseJob", () => ({
  readPendingChangesets: vi.fn(async () => []),
}));

let cwd: string;
let workDir: string;

beforeEach(async () => {
  cwd = process.cwd();
  workDir = await mkdtemp(join(tmpdir(), "changeset-check-"));
  process.chdir(workDir);
  process.exitCode = undefined;
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.stubEnv("GITHUB_ACTIONS", undefined as any);
  vi.stubEnv("GL_TOKEN", undefined as any);
  vi.stubEnv("CI_MERGE_REQUEST_TARGET_BRANCH_NAME", "main");
});

afterEach(async () => {
  process.chdir(cwd);
  process.exitCode = undefined;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(workDir, { recursive: true, force: true });
});

describe("changesetCheckJob on gitlab", () => {
  it("exits 0 when the merge request adds no changeset — a failed job would never resolve its exposed report", async () => {
    gitMock.addedFiles = ["src/index.ts"];

    await changesetCheckJob();

    expect(process.exitCode).toBeUndefined();
    const report = await readFile(CHANGESET_REPORT_FILE, "utf-8");
    expect(report).toContain("adds no changeset");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("⚠️  this merge request adds no changeset"),
    );
  });

  it("exits 0 and reports the changesets the merge request adds", async () => {
    gitMock.addedFiles = [".changeset/brave-cats.md"];

    await changesetCheckJob();

    expect(process.exitCode).toBeUndefined();
    const report = await readFile(CHANGESET_REPORT_FILE, "utf-8");
    expect(report).toContain("adds 1 changeset: `brave-cats.md`");
  });
});
