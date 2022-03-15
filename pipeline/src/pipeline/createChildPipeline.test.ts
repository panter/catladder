import { Config } from "../types";
import { createChildPipeline } from "./createChildPipeline";

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
            cluster: {
              type: "gcloud",
              name: "mega-cluster",
              projectId: "super-google-project",
              region: "ch-blabla",
            },
          },
        },
      },
    };

    it("creates a pipeline for a single app on the main branch", async () => {
      const { image, jobs } = await createChildPipeline(
        "gitlab",
        "mainBranch",
        config
      );
      expect(image).toEqual(
        "git.panter.ch:5001/catladder/catladder/base-pipeline:"
      );

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
