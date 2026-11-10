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

  describe("per workflow image coverage", () => {
    const stepNames = (w: any) =>
      (w.jobs["catladder-images"]?.steps ?? []).map((s: any) => s.name);
    const needsOf = (w: any, id: string) => w.jobs[id]?.needs ?? [];

    it("create-release needs the combined job, which builds only the release image", async () => {
      const w: any = await workflowsOf(config({ when: "onGreen" }));
      const cr = w["catladder-create-release.yml"];
      expect(needsOf(cr, "create-release")).toEqual(["catladder-images"]);
      expect(stepNames(cr).filter((n: string) => n !== "Checkout")).toEqual([
        "🐳 catladder image semantic-release",
      ]);
    });

    it("main ensures semantic-release for release-on-green, review does not", async () => {
      const w: any = await workflowsOf(config({ when: "onGreen" }));
      expect(stepNames(w["catladder-main.yml"])).toContain(
        "🐳 catladder image semantic-release",
      );
      expect(stepNames(w["catladder-review.yml"])).not.toContain(
        "🐳 catladder image semantic-release",
      );
    });

    it("keeps the combined job in the catladder-ok gate needs", async () => {
      const w: any = await workflowsOf(config({ when: "onGreen" }));
      expect(needsOf(w["catladder-review.yml"], "catladder-ok")).toContain(
        "catladder-images",
      );
    });

    it("has no image job and no dangling needs in stop workflows", async () => {
      const w: any = await workflowsOf(config({ when: "onGreen" }));
      for (const name of ["catladder-review-stop.yml", "catladder-stop.yml"]) {
        expect(Object.keys(w[name].jobs)).not.toContain("catladder-images");
        for (const job of Object.values<any>(w[name].jobs)) {
          expect(
            (job.needs ?? []).filter((n: string) => n.includes("image")),
          ).toEqual([]);
        }
      }
    });

    it("has no needs pointing at a missing job in any workflow", async () => {
      const w: any = await workflowsOf(config({ when: "onGreen" }));
      for (const wf of Object.values<any>(w)) {
        const ids = Object.keys(wf.jobs);
        for (const job of Object.values<any>(wf.jobs)) {
          for (const n of job.needs ?? []) expect(ids).toContain(n);
        }
      }
    });

    it("uses one combined job in the deploy-review workflow", async () => {
      const w: any = await new GithubBackend().createWorkflows({
        ...config({ when: "onGreen" }),
        reviewApps: { deploy: "optIn" },
      } as unknown as Config);
      const d = w["catladder-deploy-review.yml"];
      expect(d).toBeDefined();
      const imageJobs = Object.keys(d.jobs).filter((id) =>
        id.includes("images"),
      );
      expect(imageJobs).toEqual(["catladder-images"]);
    });
  });
});
