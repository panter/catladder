import open from "open";
import { GOOGLE_PROJECT } from "../../../../config/constants";

export const openGoogleCloudLogs = async (
  googleAuthUserNumber = 0,
  clustername?: string,
  namespace?: string
) => {
  const resource = clustername
    ? `k8s_container/cluster_name/${clustername}${
        namespace ? `/namespace_name/${namespace}` : ""
      }`
    : null;

  const url = `https://console.cloud.google.com/logs/viewer?project=${GOOGLE_PROJECT}${
    resource ? `&resource=${encodeURIComponent(resource)}` : ""
  }&authuser=${googleAuthUserNumber}`;
  open(url);
};

export const openGoogleCloudKubernetesDashboard = async (
  googleAuthUserNumber = 0,
  clustername?: string,
  namespace?: string
) => {
  const url = `https://console.cloud.google.com/kubernetes/workload?authuser=${googleAuthUserNumber}&project=${GOOGLE_PROJECT}&pageState=(%22savedViews%22:(%22c%22:%5B%22gke%2Feurope-west1-d%2F${clustername}%22%5D,${
    namespace ? `%22n%22:%5B%22${namespace}%22%5D` : ""
  }))`;

  open(url);
};
