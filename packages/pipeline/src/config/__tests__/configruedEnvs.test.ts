import { describe, it, expect } from "vitest";
import { getAllEnvsByTrigger, getConfiguredBranchTriggers } from "..";
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

  describe("project-wide `environments` config", () => {
    const CONFIG_WITH_ENVIRONMENTS: Config = {
      appName: "my-app",
      customerName: "pan",
      environments: {
        // dev moved to a branch pipeline
        dev: { on: { branch: "develop" } },
        // an extra stable env deploying on pushes to `next`
        next: { type: "dev", on: { branch: "next" } },
        // a stage that deploys with the main branch instead of tags
        stage: { on: "mainBranch" },
        // an env that is in no pipeline at all
        prod: { on: false },
      },
      components: {
        app1: {
          dir: "dir1",
          build: { type: "node" },
          deploy: { type: "kubernetes", cluster },
        },
        app2: {
          dir: "dir2",
          build: { type: "node" },
          deploy: { type: "kubernetes", cluster },
          env: {
            next: false, // opts out of the declared env
          },
        },
      },
    };

    it("`on` overrides the env type's default trigger", () => {
      expect(
        getAllEnvsByTrigger(CONFIG_WITH_ENVIRONMENTS, "app1", "mainBranch"),
      ).toEqual(["stage"]);
      expect(
        getAllEnvsByTrigger(CONFIG_WITH_ENVIRONMENTS, "app1", "taggedRelease"),
      ).toEqual([]);
      expect(
        getAllEnvsByTrigger(CONFIG_WITH_ENVIRONMENTS, "app1", "mr"),
      ).toEqual(["review"]);
    });

    it("selects envs for branch triggers", () => {
      expect(
        getAllEnvsByTrigger(CONFIG_WITH_ENVIRONMENTS, "app1", {
          branch: "develop",
        }),
      ).toEqual(["dev"]);
      expect(
        getAllEnvsByTrigger(CONFIG_WITH_ENVIRONMENTS, "app1", {
          branch: "next",
        }),
      ).toEqual(["next"]);
      expect(
        getAllEnvsByTrigger(CONFIG_WITH_ENVIRONMENTS, "app1", {
          branch: "other",
        }),
      ).toEqual([]);
    });

    it("declared envs apply to all components unless opted out", () => {
      expect(
        getAllEnvsByTrigger(CONFIG_WITH_ENVIRONMENTS, "app2", {
          branch: "next",
        }),
      ).toEqual([]);
    });

    it("collects the configured branch triggers, deduplicated and sorted", () => {
      expect(getConfiguredBranchTriggers(CONFIG_WITH_ENVIRONMENTS)).toEqual([
        { branch: "develop" },
        { branch: "next" },
      ]);
      expect(getConfiguredBranchTriggers(SIMPLE_CONFIG)).toEqual([]);
    });

    it("throws for a declared custom env without a type", () => {
      const config: Config = {
        ...CONFIG_WITH_ENVIRONMENTS,
        environments: { sandbox: {} },
      };
      expect(() => getAllEnvsByTrigger(config, "app1", "mainBranch")).toThrow(
        'environment "sandbox" needs a type',
      );
    });
  });
});
