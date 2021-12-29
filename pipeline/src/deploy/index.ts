import { GitlabJobs } from "../types/gitlab-types";
import { Context } from "../types/context";
import { createKubernetesDeployJobs } from "./kubernetes";
import { DeployConfig } from "./types";

type DeployTypes = {
  [type in DeployConfig["type"]]: {
    jobs: (context: Context) => GitlabJobs;
    defaults: () => Partial<Extract<DeployConfig, { type: type }>>;
  };
};

export const DEPLOY_TYPES: DeployTypes = {
  kubernetes: {
    jobs: createKubernetesDeployJobs,
    defaults: () => ({}),
  },
};
