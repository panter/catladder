import { describe, expect, it } from "vitest";
import { JobImagesPlan } from "../../../customImages/jobImagesPlan";
import { createAllJobs } from "../../../pipeline/createAllJobs";
import type { Config } from "../../../types";
import {
  DEFAULT_HANDOFF_ARTIFACT_RETENTION_DAYS,
  createArtifactUploadSteps,
  resolveArtifactRetentionDays,
} from "../artifactArchive";
import { getUploadProviderIds, makeGithubJob } from "../createGithubJobs";
import { githubRegistryImageFromConfig } from "../registryImage";
import { GithubScriptFiles } from "../scriptFiles";

const uploadWith = (retentionDays?: number) =>
  createArtifactUploadSteps("job", ["dist"], undefined, retentionDays).find(
    (step) => step.uses?.startsWith("actions/upload-artifact"),
  )?.with as Record<string, unknown>;

describe("createArtifactUploadSteps", () => {
  it("omits retention-days when undefined", () => {
    expect(uploadWith()).not.toHaveProperty("retention-days");
  });

  it("emits retention-days after if-no-files-found when defined", () => {
    const withOptions = uploadWith(7);
    expect(withOptions["retention-days"]).toBe(7);
    expect(Object.keys(withOptions)).toEqual([
      "name",
      "path",
      "if-no-files-found",
      "retention-days",
    ]);
  });
});

describe("resolveArtifactRetentionDays", () => {
  const handoff = { paths: ["dist"], expire_in: "1 day" };
  const report = { paths: ["report.xml"], reports: {} };

  it("defaults hand-off build artifacts to 3 days", () => {
    expect(DEFAULT_HANDOFF_ARTIFACT_RETENTION_DAYS).toBe(3);
    expect(resolveArtifactRetentionDays(handoff)).toBe(3);
  });

  it("lets the configuration override the hand-off default", () => {
    expect(resolveArtifactRetentionDays(handoff, 7)).toBe(7);
  });

  it("leaves report/project artifacts at the repository default", () => {
    expect(resolveArtifactRetentionDays(report)).toBeUndefined();
    expect(resolveArtifactRetentionDays(undefined)).toBeUndefined();
  });

  it("applies the configuration to report/project artifacts", () => {
    expect(resolveArtifactRetentionDays(report, 7)).toBe(7);
  });

  it.each([0, -1, 1.5, 91, NaN])("rejects %s", (value) => {
    expect(() => resolveArtifactRetentionDays(undefined, value)).toThrow(
      /artifactRetentionDays/,
    );
  });

  it.each([1, 90])("accepts the boundary %s", (value) => {
    expect(resolveArtifactRetentionDays(undefined, value)).toBe(value);
  });
});

const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: { github: true },
  components: {
    api: {
      dir: "api",
      build: { type: "node" },
      deploy: false,
    },
  },
} as unknown as Config;

describe("makeGithubJob", () => {
  const uploadRetention = async (retentionDays?: number) => {
    const allJobs = await createAllJobs({
      config,
      trigger: "mainBranch",
      pipelineType: "github",
    });
    const uploadProviderIds = getUploadProviderIds(allJobs);
    const images = new JobImagesPlan(
      "github",
      config.images,
      githubRegistryImageFromConfig(config),
    );
    const scripts = new GithubScriptFiles();
    const uploads: Record<string, unknown>[] = [];
    [...allJobs.workspaces, ...allJobs.components].forEach(
      ({ context, jobs }) =>
        jobs.forEach((job) => {
          const [, githubJob] = makeGithubJob(
            context,
            job,
            allJobs,
            uploadProviderIds,
            images,
            scripts,
            undefined,
            retentionDays,
          );
          githubJob.steps
            .filter((step) => step.uses?.startsWith("actions/upload-artifact"))
            .forEach((step) => uploads.push(step.with as any));
        }),
    );
    return uploads;
  };

  it("passes the configured retention to the upload step", async () => {
    const uploads = await uploadRetention(7);
    expect(uploads.length).toBeGreaterThan(0);
    expect(uploads.every((w) => w["retention-days"] === 7)).toBe(true);
  });

  it("rejects an invalid retention", async () => {
    await expect(uploadRetention(0)).rejects.toThrow(/artifactRetentionDays/);
  });
});
