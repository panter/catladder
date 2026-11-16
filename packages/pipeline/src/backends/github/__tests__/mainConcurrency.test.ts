import { describe, expect, it } from "vitest";
import type { Config, PipelineOutputOptions } from "../../../types";
import { GithubBackend } from "../GithubBackend";

const baseConfig = {
  appName: "test-app",
  customerName: "pan",
  pipelines: { github: true },
  components: {
    api: {
      dir: "api",
      build: { type: "node" },
      deploy: {
        type: "kubernetes",
        cluster: {
          name: "test",
          region: "europe-west6",
          projectId: "test",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
      },
    },
  },
} as unknown as Config;

const workflowsWith = (main: unknown) =>
  new GithubBackend().createWorkflows({
    ...baseConfig,
    pipelines: {
      github: { concurrency: { main } } as PipelineOutputOptions,
    },
  });

describe("github main concurrency", () => {
  it("omits concurrency by default and preserves review and release settings", async () => {
    const defaults = await new GithubBackend().createWorkflows(baseConfig);
    const configured = await workflowsWith({ cancelInProgress: true });
    expect(defaults["catladder-main.yml"]).not.toHaveProperty("concurrency");
    for (const [name, workflow] of Object.entries(defaults)) {
      if (name !== "catladder-main.yml") {
        expect(configured[name]).toEqual(workflow);
      }
    }
  });

  it.each([
    [{}, { group: "catladder-main", "cancel-in-progress": false }],
    [
      { cancelInProgress: true },
      { group: "catladder-main", "cancel-in-progress": true },
    ],
    [{ group: "x" }, { group: "x", "cancel-in-progress": false }],
    [
      { group: "x", cancelInProgress: false },
      { group: "x", "cancel-in-progress": false },
    ],
  ])("emits the configured main concurrency for %j", async (main, expected) => {
    const workflows = await workflowsWith(main);
    expect(workflows["catladder-main.yml"].concurrency).toEqual(expected);
  });

  it("does not read concurrency from GitLab options", async () => {
    const workflows = await new GithubBackend().createWorkflows({
      ...baseConfig,
      pipelines: {
        gitlab: {
          concurrency: { main: { group: "ignored", cancelInProgress: true } },
        },
      },
    });
    expect(workflows["catladder-main.yml"]).not.toHaveProperty("concurrency");
  });

  it("does not apply main settings to branch workflows", async () => {
    const workflows = await new GithubBackend().createWorkflows({
      ...baseConfig,
      pipelines: { github: { concurrency: { main: {} } } },
      environments: { next: { type: "dev", on: { branch: "next" } } },
    });
    const branch = Object.values(workflows).find(
      (workflow) => workflow.name === "🛠️ catladder next",
    );
    expect(branch).toBeDefined();
    expect(branch).not.toHaveProperty("concurrency");
  });

  it.each(["", "   ", 1, false, null])(
    "rejects invalid group %j",
    async (group) => {
      await expect(workflowsWith({ group })).rejects.toThrow(
        "pipelines.github.concurrency.main.group",
      );
    },
  );

  it.each(["true", 1, null])(
    "rejects invalid cancelInProgress %j",
    async (cancelInProgress) => {
      await expect(workflowsWith({ cancelInProgress })).rejects.toThrow(
        "pipelines.github.concurrency.main.cancelInProgress",
      );
    },
  );
});
