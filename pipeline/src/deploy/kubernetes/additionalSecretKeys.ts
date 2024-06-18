import type { BuildConfig } from "../../build";
import type { EnvironmentContext } from "../../types/environmentContext";
import type { DeployConfigKubernetes } from "../types";

export const additionalKubernetesSecretKeys = ({
  deployConfigRaw,
}: EnvironmentContext<BuildConfig, DeployConfigKubernetes>) => {
  if (!deployConfigRaw) {
    return [];
  }
  const keys = [];
  if (deployConfigRaw.values?.mongodb?.enabled) {
    keys.push("MONGODB_ROOT_PASSWORD");
    if (deployConfigRaw.values.mongodb.architecture === "replicaset") {
      keys.push("MONGODB_REPLICASET_KEY");
    }
  }

  if (deployConfigRaw.values?.cloudsql?.enabled) {
    keys.push("POSTGRESQL_PASSWORD");
    keys.push("cloudsqlProxyCredentials");
  }

  return keys.map((key) => ({ key }));
};
