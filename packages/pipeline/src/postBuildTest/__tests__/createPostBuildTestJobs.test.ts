import { describe, expect, it } from "vitest";
import type { Config } from "../../types/config";
import { getGitlabCompletePipeline } from "../..";

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

  describe("environments", () => {
    const e2eJobs = async (config: Config) =>
      (await jobNames(config))
        .filter((n) => n.includes("🔬 e2e"))
        .map((n) => n.trim());

    it("limits a component test to the listed envs", async () => {
      expect(
        await e2eJobs({
          ...BASE,
          components: {
            web: {
              dir: "web",
              build: {
                type: "node",
                postBuildTests: {
                  e2e: { command: "yarn e2e", environments: ["dev"] },
                },
              },
              deploy: DEPLOY,
            },
          },
        }),
      ).toEqual(["web 🔬 e2e | dev"]);
    });

    it("limits a workspace test to the listed envs", async () => {
      expect(
        await e2eJobs({
          ...BASE,
          builds: {
            ws: {
              type: "node",
              postBuildTests: {
                e2e: { command: "yarn e2e", environments: ["dev"] },
              },
            },
          },
          components: {
            web: { dir: "web", build: { from: "ws" }, deploy: DEPLOY },
          },
        }),
      ).toEqual(["🔸 ws 🔬 e2e | dev"]);
    });

    it("rejects unknown env names", async () => {
      await expect(
        e2eJobs({
          ...BASE,
          components: {
            web: {
              dir: "web",
              build: {
                type: "node",
                postBuildTests: {
                  e2e: { command: "yarn e2e", environments: ["deev"] },
                },
              },
              deploy: DEPLOY,
            },
          },
        }),
      ).rejects.toThrow(
        "postBuildTests.e2e.environments contains unknown env(s) deev",
      );
    });
  });
});
