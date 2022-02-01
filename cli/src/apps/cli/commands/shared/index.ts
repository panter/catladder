import { DeployConfigKubernetesCluster } from "@catladder/pipeline";
import open from "open";

export const openGoogleCloudLogs = async (
  cluster?: DeployConfigKubernetesCluster,
  namespace?: string,
  googleAuthUserNumber = 0
) => {
  const resource = `k8s_container/cluster_name/${cluster.name}${
    namespace ? `/namespace_name/${namespace}` : ""
  }`;

  const url = `https://console.cloud.google.com/logs/viewer?project=${
    cluster.projectId
  }${
    resource ? `&resource=${encodeURIComponent(resource)}` : ""
  }&authuser=${googleAuthUserNumber}`;
  open(url);
};

export const openGoogleCloudKubernetesDashboard = async (
  cluster: DeployConfigKubernetesCluster,
  namespace: string,
  googleAuthUserNumber = 0
) => {
  //gke_skynet-164509_europe-west1-d_production

  const pageState = `pageState=("savedViews":("c":["gke/${cluster.region}/${cluster.name}"],"n":["${namespace}"],"i":"4e42e0b9cd6147f8a4fba7516752ec48"))`;
  const url = `https://console.cloud.google.com/kubernetes/workload?authuser=${googleAuthUserNumber}&project=${
    cluster.projectId
  }&pageState=${encodeURIComponent(pageState)}`;

  open(url);
};
