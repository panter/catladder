import { execFileSync } from "child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createArtifactUploadSteps } from "../artifactArchive";

const archiveScript = (paths: string[], exclude?: string[]) =>
  createArtifactUploadSteps("job", paths, undefined, undefined, exclude)[0]
    .run as string;

describe("artifact excludes on github", () => {
  it("adds no exclude list without excludes", () => {
    expect(archiveScript(["dist"])).not.toContain("-X");
  });

  it("archives the paths without the excluded globs", () => {
    const dir = mkdtempSync(join(tmpdir(), "catladder-artifacts-"));
    mkdirSync(join(dir, "app/.next/cache/webpack"), { recursive: true });
    mkdirSync(join(dir, "app/.next/server"), { recursive: true });
    writeFileSync(join(dir, "app/.next/cache/webpack/pack"), "cache");
    writeFileSync(join(dir, "app/.next/server/page.js"), "page");
    writeFileSync(join(dir, "app/.env"), "SECRET=1");
    symlinkSync("server", join(dir, "app/.next/link"));

    execFileSync(
      "bash",
      [
        "-c",
        archiveScript(
          ["app/.next", "app/.env"],
          ["app/.next/cache/**/*", "app/.env"],
        ),
      ],
      { cwd: dir },
    );
    const entries = execFileSync(
      "tar",
      ["-tf", "catladder-artifacts-job.tar"],
      {
        cwd: dir,
      },
    )
      .toString()
      .split("\n")
      .filter(Boolean)
      .map((entry) => entry.replace(/\/$/, ""));

    expect(entries).toContain("app/.next/server/page.js");
    expect(entries).toContain("app/.next/link");
    expect(entries).not.toContain("app/.next/cache/webpack/pack");
    expect(entries).not.toContain("app/.next/cache/webpack");
    expect(entries).not.toContain("app/.env");
  });
});
