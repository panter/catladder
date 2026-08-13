import { describe, it, expect } from "vitest";
import { getAllEnvsByTrigger } from "..";
import type { DeployConfigKubernetesCluster } from "../..";
import type { Config } from "../../types";

describe("getAllEnvsByTrigger", () => {
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

  describe("mainBranch", () => {
    it("always includes dev if not disabled", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app1", "mainBranch");
      expect(envs).toEqual(["dev"]);
    });
    it("returns additional dev environments", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app2", "mainBranch");
      expect(envs).toEqual(["dev", "dev2"]);
    });
    it("does not include disabled envs", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app3", "mainBranch");
      expect(envs).toEqual([]);
    });
  });

  describe("mr", () => {
    it("always includes review if not disabled", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app1", "mr");
      expect(envs).toEqual(["review"]);
    });
    it("returns additional dev environments", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app2", "mr");
      expect(envs).toEqual(["review", "review2"]);
    });
    it("does not include disabled envs", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app3", "mr");
      expect(envs).toEqual([]);
    });
  });

  describe("taggedRelease", () => {
    it("always includes review if not disabled", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app1", "taggedRelease");
      expect(envs).toEqual(["stage", "prod"]);
    });
    it("returns additional dev environments", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app2", "taggedRelease");
      expect(envs).toEqual(["stage", "prod", "stage2", "prod2"]);
    });
    it("does not include disabled envs", () => {
      const envs = getAllEnvsByTrigger(SIMPLE_CONFIG, "app3", "taggedRelease");
      expect(envs).toEqual([]);
    });
  });
});
