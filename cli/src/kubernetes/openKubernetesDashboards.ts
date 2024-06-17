import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import type { CommandInstance } from "vorpal";
import { openGoogleCloudDashboard } from "../gcloud/openDashboard";

export const openGoogleCloudLogs = async (
  instance: CommandInstance,
  context: ComponentContext,
) => {
  const deployConfig = context.componentConfig.deploy;
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    throw new Error("context is not of type kubernetes");
  }

  if (!deployConfig.cluster || deployConfig.cluster.type !== "gcloud") {
    throw new Error("no gcloud custer configured");
  }

  const namespace = context.environment.envVars.KUBE_NAMESPACE;
  const cluster = deployConfig.cluster;

  const resource = `k8s_container/cluster_name/${cluster.name}${
    namespace ? `/namespace_name/${namespace}` : ""
  }`;

  await openGoogleCloudDashboard(instance, "logs/viewer", {
    project: cluster.projectId,
    resource: resource,
  });
};

export const openGoogleCloudKubernetesDashboard = async (
  instance: CommandInstance,
  context: ComponentContext,
) => {
  const deployConfig = context.componentConfig.deploy;
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    throw new Error("context is not of type kubernetes");
  }

  if (!deployConfig.cluster || deployConfig.cluster.type !== "gcloud") {
    throw new Error("no gcloud custer configured");
  }
  const namespace = context.environment.envVars.KUBE_NAMESPACE;
  const cluster = deployConfig.cluster;
  const pageState = `("savedViews":("c":["gke/${cluster.region}/${cluster.name}"],"n":["${namespace}"],"i":"4e42e0b9cd6147f8a4fba7516752ec48"))`;

  await openGoogleCloudDashboard(instance, "kubernetes/workload", {
    project: cluster.projectId,
    pageState: pageState,
  });
};
