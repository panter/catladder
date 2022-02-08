import { Config } from "../types";
import type { DeployConfigKubernetesCluster } from "./types";

export const getFullKubernetesClusterName = (
  cluster: DeployConfigKubernetesCluster
) => {
  if (cluster.type === "gcloud") {
    return `gke_${cluster.projectId}_${cluster.region}_${cluster.name}`;
  }
};

export const getKubernetesNamespace = (
  config: Pick<Config, "customerName" | "appName">,
  env: string
) => {
  return `${config.customerName}-${config.appName}-${env}`;
};
