import type { Context } from "@catladder/pipeline";

export const openGoogleCloudRunDashboard = async (
  context: Context,
  googleAuthUserNumber = 0
) => {
  const pageState = `("savedViews":("c":["gke/${cluster.region}/${cluster.name}"],"n":["${namespace}"],"i":"4e42e0b9cd6147f8a4fba7516752ec48"))`;
  const url = `https://console.cloud.google.com/kubernetes/workload?authuser=${googleAuthUserNumber}&project=${
    cluster.projectId
  }&pageState=${encodeURIComponent(pageState)}`;

  open(url);
};
