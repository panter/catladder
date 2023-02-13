import type { EnvironmentContext } from "../../types/environmentContext";

export const additionalKubernetesSecretKeys = ({
  deployConfigRaw,
}: EnvironmentContext<any, "kubernetes">) => {
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
