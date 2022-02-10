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
  // ?authuser=1&project=skynet-swiss&pageState=pageState%3D(%22savedViews%22:(%22c%22:%5B%22gke%2Feurope-west6-a%2Fch-production%22%5D,%22n%22:%5B%22pvl-bike2school-review%22%5D,%22i%22:%224e42e0b9cd6147f8a4fba7516752ec48%22))
  // ?authuser=1&project=skynet-swiss&pageState=(%22savedViews%22:(%22i%22:%2279802e2b154d46d480dff4e086e87875%22,%22c%22:%5B%22gke%2Feurope-west6-a%2Fch-production%22%5D,%22n%22:%5B%22pvl-bike2school-review%22%5D))

  const pageState = `("savedViews":("c":["gke/${cluster.region}/${cluster.name}"],"n":["${namespace}"],"i":"4e42e0b9cd6147f8a4fba7516752ec48"))`;
  const url = `https://console.cloud.google.com/kubernetes/workload?authuser=${googleAuthUserNumber}&project=${
    cluster.projectId
  }&pageState=${encodeURIComponent(pageState)}`;

  open(url);
};
