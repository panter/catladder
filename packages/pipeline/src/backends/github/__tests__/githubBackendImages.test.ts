import { describe, expect, it } from "vitest";
import type { Config } from "../../../types";
import { GithubBackend } from "../GithubBackend";

const config = (releases?: object) =>
  ({
    appName: "test-app",
    customerName: "pan",
    pipelines: { github: true },
    ...(releases ? { releases } : {}),
    store: {
      gcloudProjects: { "some-project": { projectNumber: "123456789012" } },
    },
    components: {
      web: {
        dir: "web",
        build: { type: "node" },
        deploy: {
          type: "google-cloudrun",
          projectId: "some-project",
          region: "europe-west6",
        },
      },
    },
  }) as unknown as Config;

const workflowsOf = (c: Config) => new GithubBackend().createWorkflows(c);
const allJobs = (workflows: Record<string, any>) =>
  Object.values(workflows).flatMap((w) => Object.entries(w.jobs ?? {}));

describe("github combined image job", () => {
  it("generates at most one catladder-images job per workflow", async () => {
    const workflows = await workflowsOf(config({ when: "manual" }));
    for (const w of Object.values(workflows) as any[]) {
      const ids = Object.keys(w.jobs ?? {}).filter(
        (id) => id === "catladder-images",
      );
      expect(ids.length).toBeLessThanOrEqual(1);
    }
  });

  it("never leaves per-image ensure jobs behind", async () => {
    const workflows = await workflowsOf(config({ when: "manual" }));
    const ids = allJobs(workflows).map(([id]) => id);
    expect(ids.filter((id) => id.startsWith("catladder-image-"))).toEqual([]);
  });

  it("has no image job in the review stop workflow", async () => {
    const workflows = await workflowsOf(config({ when: "manual" }));
    const stop = workflows["catladder-review-stop.yml"];
    if (stop) {
      expect(Object.keys(stop.jobs)).not.toContain("catladder-images");
    }
  });
});
