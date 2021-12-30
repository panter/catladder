import { Config } from "../types";
import { createChildPipeline } from "../";

describe("createChildPipeline", () => {
  describe("node-app to kuberntes", () => {
    const config: Config = {
      appName: "test",
      customerName: "pan",
      components: {
        "my-app": {
          dir: "myapp",
          build: {
            type: "node",
          },
          deploy: {
            type: "kubernetes",
          },
        },
      },
    };

    it("creates a pipeline for a single app on the main branch", async () => {
      const { image, stages, workflow, ...jobs } = await createChildPipeline(
        "mainBranch",
        config
      );
      expect(image).toEqual("git.panter.ch:5001/catladder/gitlab-ci/pipeline:");

      expect(Object.keys(jobs)).toEqual([
        "my-app audit",
        "my-app lint",
        "my-app test",
        "dev my-app app-build",
        "dev my-app docker-build",
        "dev my-app deploy-to-kubernetes",
        "dev my-app kubernetes-stop",
      ]);
    });
  });
});
