import { describe, it, expect } from "vitest";
import { type DeployConfigKubernetesCluster } from "../../..";
import type { Config } from "../../../types";
import { getPipelineStages } from "../getPipelineStages";

describe("getPipelineStages()", () => {
  const cluster: DeployConfigKubernetesCluster = {
    type: "gcloud",
    name: "mega-cluster",
    projectId: "super-google-project",
    region: "ch-blabla",
  };
  const SIMPLE_CONFIG1: Config = {
    appName: "my-app",
    customerName: "pan",
    components: {
      app1: {
        dir: "dir1",
        build: {
          type: "node",
        },
        deploy: { type: "kubernetes", cluster },
      },
      app2: {
        dir: "dir2",
        build: {
          type: "node",
        },
        deploy: { type: "kubernetes", cluster },
        env: {
          dev2: {
            type: "dev",
          },
          review2: {
            type: "review",
          },
          stage2: {
            type: "stage",
          },
          prod2: {
            type: "prod",
          },
        },
      },
      app3: {
        dir: "dir2",
        build: {
          type: "node",
        },
        deploy: { type: "kubernetes", cluster },
        env: {
          dev: false,
          review: false,
          stage: false,
          prod: false,
        },
      },
    },
  };

  it("should return all envs for SIMPLE_CONFIG1", () => {
    expect(getPipelineStages(SIMPLE_CONFIG1)).toMatchSnapshot();
  });

  it("only includes the post-build stages when a job uses them", () => {
    expect(getPipelineStages(SIMPLE_CONFIG1)).not.toContain("post-build");
    const stages = getPipelineStages(
      SIMPLE_CONFIG1,
      new Set(["build dev", "post-build dev"]),
    );
    expect(stages).toContain("post-build");
    expect(stages).toContain("post-build dev");
    expect(stages.indexOf("post-build")).toBeGreaterThan(
      stages.indexOf("build"),
    );
    expect(stages.indexOf("post-build")).toBeLessThan(stages.indexOf("deploy"));
  });
});
