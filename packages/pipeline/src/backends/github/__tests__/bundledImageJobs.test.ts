import { describe, expect, it } from "vitest";
import type { Config } from "../../../types";
import { GithubBackend } from "../GithubBackend";

const config = (releases?: object) =>
  ({
    appName: "test-app",
    customerName: "pan",
    pipelines: { github: true },
    ...(releases ? { releases } : {}),
    components: {
      api: {
        dir: "api",
        build: { type: "node" },
        deploy: {
          type: "kubernetes",
          cluster: {
            name: "some-cluster-name",
            region: "europe-west6",
            projectId: "some-project-id",
            type: "gcloud",
            domainCanonical: "panter.cloud",
          },
        },
      },
    },
  }) as unknown as Config;

const imageJobIds = (jobs: Record<string, unknown>) =>
  Object.keys(jobs).filter((id) => id.startsWith("catladder-image"));

describe("bundled image jobs in the github workflows", () => {
  it("every workflow has at most the one bundled image job and no per-image needs", async () => {
    const workflows = await new GithubBackend().createWorkflows(config({}));
    for (const workflow of Object.values(workflows)) {
      expect(imageJobIds(workflow.jobs).length).toBeLessThanOrEqual(1);
      for (const job of Object.values(workflow.jobs)) {
        expect(
          (job.needs ?? []).filter((id) => /^catladder-image-/.test(id)),
        ).toEqual([]);
      }
    }
  });

  it("an image job exists in a workflow only when a job needs it", async () => {
    const workflows = await new GithubBackend().createWorkflows(config());
    for (const workflow of Object.values(workflows)) {
      const needed = Object.values(workflow.jobs).some((job) =>
        (job.needs ?? []).includes("catladder-images"),
      );
      // the aggregate gate and the release image are the only other reasons
      if (!needed) {
        expect(imageJobIds(workflow.jobs)).toEqual([]);
      }
    }
  });

  it("the catladder-ok gate still needs the bundle", async () => {
    const workflows = await new GithubBackend().createWorkflows(config());
    const review = workflows["catladder-review.yml"];
    expect(review.jobs["catladder-images"]).toBeDefined();
    expect(review.jobs["catladder-ok"].needs).toContain("catladder-images");
  });

  it("the release image is ensured in main and the release job needs the bundle", async () => {
    const workflows = await new GithubBackend().createWorkflows(
      config({ when: "auto" }),
    );
    const main = workflows["catladder-main.yml"];
    const script = main.jobs["catladder-images"].steps[1].run as string;
    expect(script).toContain("semantic-release");
    expect(main.jobs["create-release"].needs).toContain("catladder-images");

    const create = workflows["catladder-create-release.yml"];
    expect(Object.keys(create.jobs)).toContain("catladder-images");
    expect(create.jobs["create-release"].needs).toEqual(["catladder-images"]);
  });
});
