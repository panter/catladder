import { describe, expect, it } from "vitest";
import type { Config } from "../../../types";
import { GithubBackend } from "../GithubBackend";

const baseConfig = {
  appName: "test-app",
  customerName: "pan",
  pipelines: { github: true },
  releases: {
    when: "manual",
    requireStatus: { context: "e2e-main", workflow: "🔬 e2e main" },
  },
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

const workflowsWith = (patch: Partial<Config>) =>
  new GithubBackend().createWorkflows({ ...baseConfig, ...patch } as Config);

describe("releases.requireStatus (github)", () => {
  it("triggers release-on-green on the gate workflow and pins the gated commit", async () => {
    const workflows = await workflowsWith({});
    const onGreen = workflows["catladder-release-on-green.yml"];
    expect(onGreen.on).toEqual({
      workflow_run: {
        workflows: ["🛠️ catladder main", "🔬 e2e main"],
        types: ["completed"],
      },
    });
    const guard = onGreen.jobs.guard;
    expect(guard.env).toMatchObject({
      CATLADDER_RELEASE_REQUIRED_STATUS: "e2e-main",
      CATLADDER_RELEASE_GATE_WORKFLOW: "🔬 e2e main",
    });
    expect(guard.permissions).toMatchObject({
      statuses: "read",
      checks: "read",
    });
    expect(guard.outputs).toHaveProperty("sha");
    expect(JSON.stringify(guard.steps)).toContain(
      "${{ github.event.workflow_run.name }}",
    );
    const release = onGreen.jobs["create-release"];
    expect(release.steps?.[1]).toMatchObject({
      name: "check gated commit",
      env: { GATED_SHA: "${{ needs.guard.outputs.sha }}" },
    });

    const createRelease =
      workflows["catladder-create-release.yml"].jobs["create-release"];
    expect(createRelease.env).toMatchObject({
      CATLADDER_RELEASE_REQUIRED_STATUS: "e2e-main",
    });
    expect(
      createRelease.steps?.some((step) => step.name === "check gated commit"),
    ).toBe(false);
  });

  it("generates the unchanged workflows without it", async () => {
    const workflows = await workflowsWith({ releases: { when: "manual" } });
    const onGreen = workflows["catladder-release-on-green.yml"];
    expect(JSON.stringify(onGreen)).not.toContain(
      "CATLADDER_RELEASE_REQUIRED_STATUS",
    );
    expect(onGreen.jobs.guard.outputs).not.toHaveProperty("sha");
  });

  it.each<[Partial<Config>, string]>([
    [
      {
        releases: {
          when: "auto",
          requireStatus: { context: "e2e-main", workflow: "🔬 e2e main" },
        },
      },
      'needs releases.when "manual"',
    ],
    [
      {
        releases: { requireStatus: { context: "", workflow: "x" } },
      } as Partial<Config>,
      "releases.requireStatus.context",
    ],
    [
      {
        releases: { requireStatus: { context: "x" } },
      } as unknown as Partial<Config>,
      "releases.requireStatus.workflow",
    ],
    [
      { pipelines: { github: true, gitlab: true } },
      "releases.requireStatus is github only",
    ],
  ])("rejects %j", async (patch, message) => {
    await expect(workflowsWith(patch)).rejects.toThrow(message);
  });
});
