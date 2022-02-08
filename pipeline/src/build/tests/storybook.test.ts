import { Config } from "../../types";
import { createChildPipeline } from "../../";

describe("storybook build", () => {
  describe("creates two build jobs", () => {
    const config: Config = {
      appName: "test",
      customerName: "pan",
      components: {
        "my-app": {
          dir: "myapp",
          build: {
            type: "storybook",
          },
          deploy: {
            type: "kubernetes",
            cluster: {
              name: "production",
              projectId: "bla",
              region: "europe",
              type: "gcloud",
            },
          },
        },
      },
    };

    it("creates a pipeline for storybook that does not contain test stages", async () => {
      const { image, stages, workflow, ...jobs } = await createChildPipeline(
        "mainBranch",
        config
      );

      expect(Object.keys(jobs)).toEqual([
        "dev my-app app-build",
        "dev my-app docker-build",
        "dev my-app deploy-to-kubernetes",
        "dev my-app kubernetes-stop",
      ]);
    });

    it("runs build and renames folder", async () => {
      const { image, stages, workflow, ...jobs } = await createChildPipeline(
        "mainBranch",
        config
      );
      const buildJob = jobs["dev my-app app-build"];
      expect(buildJob.script).toContain("yarn storybook");
      expect(buildJob.script).toContain("mv ./storybook-out /dist");
    });
  });
});
