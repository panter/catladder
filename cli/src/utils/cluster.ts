import { exec } from "child-process-promise";
import { findKey } from "lodash";
import clusters from "../config/clusters";
export const getCurrentContext = async () =>
  (await exec("kubectl config current-context")).stdout.trim();

export const getCurrentConnectedClusterName = async () => {
  const currentContext = await getCurrentContext();
  return findKey(clusters, { fullName: currentContext });
};

export const getClusterByFullName = (fullName: string) => {
  const found = Object.entries(getAllClusters()).find(
    ([, config]) => config.fullName === fullName
  );
  if (found) {
    return { name: found[0], cluster: found[1] };
  } else {
    return null;
  }
};

export const getClusterByName = (name: string) => getAllClusters()[name];

export const getAllClusters = () => {
  return clusters;
};

export const getAllClusterNames = () => Object.keys(clusters);

export const connectToCluster = async (clusterName: string) => {
  const { connect } = getClusterByName(clusterName);
  await connect();
};
