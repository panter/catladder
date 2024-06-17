import type { Config, ComponentContext } from "../types";
import type { DeployConfigKubernetesCluster } from "./types";
import { isOfDeployType } from "./types";

export const getFullKubernetesClusterName = (
  cluster: DeployConfigKubernetesCluster,
) => {
  if (cluster.type === "gcloud") {
    return `gke_${cluster.projectId}_${cluster.region}_${cluster.name}`;
  }
};

export const getKubernetesNamespace = (
  config: Pick<Config, "customerName" | "appName">,
  env: string,
) => {
  return `${config.customerName}-${config.appName}-${env}`;
};

export const contextIsStoppable = (context: ComponentContext) => {
  const deployConfig = context.deploy?.config;
  if (isOfDeployType(deployConfig, "kubernetes")) {
    return true;
  }

  if (isOfDeployType(deployConfig, "google-cloudrun")) {
    return true;
  }
  if (isOfDeployType(deployConfig, "custom") && deployConfig.stopScript) {
    return true;
  }

  return false;
};
