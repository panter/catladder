import { DeployConfigKubernetes } from "../types";

export const additionalKubernetesSecretKeys = (
  config: DeployConfigKubernetes
) => {
  const keys = [];
  if (config.values?.mongodb?.enabled) {
    keys.push("MONGODB_ROOT_PASSWORD");
    if (config.values.mongodb.architecture === "replicaset") {
      keys.push("MONGODB_REPLICASET_KEY");
    }
  }

  if (config.values?.cloudsql?.enabled) {
    keys.push("POSTGRESQL_PASSWORD");
    keys.push("cloudsqlProxyCredentials");
  }

  return keys;
};
