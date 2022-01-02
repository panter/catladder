import { exec } from "child-process-promise";
import { findKey } from "lodash";
import clusters from "../config/clusters";
export const getCurrentContext = async () =>
  (await exec("kubectl config current-context")).stdout.trim();

export const getCurrentConnectedClusterName = async () => {
  const currentContext = await getCurrentContext();
  return findKey(clusters, { fullName: currentContext });
};

export const getClusterByName = (name: string) => {
  return clusters[name];
};

export const getAllClusterNames = () => Object.keys(clusters);

export const connectToCluster = async (clusterName: string) => {
  const { connect } = getClusterByName(clusterName);
  await connect();
};
