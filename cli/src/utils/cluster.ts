import { $ } from "zx";

export const getCurrentContext = async () =>
  (await $`kubectl config current-context`).stdout.trim();

export const getCurrentConnectedClusterName = async () => {
  return await getCurrentContext();
};

export const connectToCluster = async (fullname: string) => {
  await $`kubectl config use-context ${fullname}`;
};
