import type { EnvVarContext } from "..";

export const additionalKubernetesSecretKeys = ({
  deployConfig,
}: EnvVarContext<"kubernetes">) => {
  if (!deployConfig) {
    return [];
  }
  const keys = [];
  if (deployConfig.values?.mongodb?.enabled) {
    keys.push("MONGODB_ROOT_PASSWORD");
    if (deployConfig.values.mongodb.architecture === "replicaset") {
      keys.push("MONGODB_REPLICASET_KEY");
    }
  }

  if (deployConfig.values?.cloudsql?.enabled) {
    keys.push("POSTGRESQL_PASSWORD");
    keys.push("cloudsqlProxyCredentials");
  }

  return keys;
};
