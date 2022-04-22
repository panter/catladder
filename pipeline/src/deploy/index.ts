import { Context } from "../types/context";
import { CatladderJob } from "../types/jobs";
import { createCustomDeployJobs } from "./custom";
import { createKubernetesDeployJobs } from "./kubernetes";
import { DeployConfig } from "./types";
export * from "./kubernetes";
export * from "./types";
export * from "./utils";
export type DeployTypes = {
  [type in DeployConfig["type"]]: {
    jobs: (context: Context) => CatladderJob[];
    defaults: () => Partial<Extract<DeployConfig, { type: type }>>;
  };
};

export const DEPLOY_TYPES: DeployTypes = {
  kubernetes: {
    jobs: createKubernetesDeployJobs,
    defaults: () => ({}),
  },
  custom: {
    jobs: createCustomDeployJobs,
    defaults: () => ({}),
  },
};
