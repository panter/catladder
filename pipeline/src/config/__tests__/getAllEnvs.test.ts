import { describe, it, expect } from "vitest";
import { type DeployConfigKubernetesCluster } from "../..";
import type { Config } from "../../types";
import { getAllEnvs } from "../configruedEnvs";

describe("getAllEnvs()", () => {
  const cluster: DeployConfigKubernetesCluster = {
    type: "gcloud",
    name: "mega-cluster",
    projectId: "super-google-project",
    region: "ch-blabla",
  };
  const SIMPLE_CONFIG: Config = {
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

  it("should return all envs for app1", () => {
    expect(getAllEnvs(SIMPLE_CONFIG, "app1")).toMatchSnapshot();
  });

  it("should return all envs for app2", () => {
    expect(getAllEnvs(SIMPLE_CONFIG, "app2")).toMatchSnapshot();
  });

  it("should return all envs for app3", () => {
    expect(getAllEnvs(SIMPLE_CONFIG, "app3")).toMatchSnapshot();
  });
});
