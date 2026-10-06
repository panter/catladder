import { describe, expect, it } from "vitest";
import type { Config } from "../../types/config";
import { getGitlabCompletePipeline } from "../../pipeline/generatePipelineFiles";

const DEPLOY = {
  type: "google-cloudrun",
  projectId: "asdf",
  region: "asia-east1",
} as const;

const BASE = {
  appName: "test-app",
  customerName: "pan",
  store: { gcloudProjects: { asdf: { projectNumber: "123" } } },
};

const jobNames = async (config: Config) =>
  Object.keys(await getGitlabCompletePipeline(config));

describe("postBuildTests", () => {
  it("creates a job per env, but not in tagged-release envs", async () => {
    const names = await jobNames({
      ...BASE,
      components: {
        web: {
          dir: "web",
          build: {
            type: "node",
            postBuildTests: { e2e: { command: "yarn e2e" } },
          },
          deploy: DEPLOY,
        },
      },
    });
    const e2eJobs = names.filter((n) => n.includes("🔬 e2e"));
    expect(e2eJobs.map((n) => n.trim())).toEqual([
      "web 🔬 e2e | dev",
      "web 🔬 e2e | review",
    ]);
  });

  it("uses the jobImage of a custom build by default", async () => {
    const pipeline = await getGitlabCompletePipeline({
      ...BASE,
      components: {
        app: {
          dir: "app",
          build: {
            type: "custom",
            jobImage: "my-toolchain:1",
            buildCommand: "make",
            docker: { type: "custom" },
            postBuildTests: { integration: { command: "make it" } },
          },
          deploy: DEPLOY,
        },
      },
    });
    const job = pipeline["app 🔬 integration | review "] as {
      image: unknown;
      script: string[];
    };
    expect(job.image).toBe("my-toolchain:1");
    // no node install for non-node builds
    expect(job.script.join("\n")).not.toContain("install");
    expect(job.script).toContain("make it");
  });

  it("rejects names that clash with other jobs", async () => {
    await expect(
      jobNames({
        ...BASE,
        components: {
          web: {
            dir: "web",
            build: {
              type: "node",
              postBuildTests: { test: { command: "yarn e2e" } },
            },
            deploy: DEPLOY,
          },
        },
      }),
    ).rejects.toThrow(/post-build test '🔬 test' clashes/);
  });

  it("rejects post-build tests whose job ids clash with each other", async () => {
    await expect(
      jobNames({
        ...BASE,
        components: {
          web: {
            dir: "web",
            build: {
              type: "node",
              postBuildTests: {
                e2e: { command: "yarn e2e" },
                E2E: { command: "yarn e2e" },
              },
            },
            deploy: DEPLOY,
          },
        },
      }),
    ).rejects.toThrow(/post-build test '🔬 E2E' clashes/);
  });

  it("runs after the build when the build has no artifacts (rails)", async () => {
    const pipeline = await getGitlabCompletePipeline({
      ...BASE,
      components: {
        app: {
          dir: "app",
          build: {
            type: "rails",
            postBuildTests: { system: { command: "bin/rails test:system" } },
          },
          deploy: DEPLOY,
        },
      },
    });
    const job = pipeline["app 🔬 system | review "] as {
      needs: Array<{ job: string; artifacts: boolean }>;
    };
    expect(job.needs).toContainEqual({
      job: "app 🔨 docker | review ",
      artifacts: false,
    });
  });
});
