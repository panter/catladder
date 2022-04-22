import { Config, Context } from "../types";
import { DeployConfigKubernetesCluster, isOfDeployType } from "./types";

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

export const contextIsStoppable = (context: Context) => {
  const deployConfig = context.componentConfig.deploy;
  if (isOfDeployType(deployConfig, "kubernetes")) {
    return true;
  }

  if (isOfDeployType(deployConfig, "custom") && deployConfig.stopScript) {
    return true;
  }

  return false;
};
