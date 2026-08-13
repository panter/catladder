import { exec } from "child-process-promise";

export const getCurrentContext = async () =>
  (await exec(`kubectl config current-context`)).stdout.trim();

export const getCurrentConnectedClusterName = async () => {
  return await getCurrentContext();
};

export const connectToCluster = async (fullname: string) => {
  await exec(`kubectl config use-context ${fullname}`);
};
