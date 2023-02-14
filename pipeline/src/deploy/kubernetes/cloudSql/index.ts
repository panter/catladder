import { getSecretVarNameForContext } from "../../../context";
import type { Context } from "../../../types";
import { getFullDbName } from "../../cloudSql/utils";
import { isOfDeployType } from "../../types";

export const hasKubernetesCloudSQL = (context: Context) => {
  if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    return context.componentConfig.deploy.values?.cloudsql?.enabled;
  }
  return false;
};

type CloudSqlValues = {
  enabled: boolean;
  proxyCredentials: string;

  instanceConnectionName: string;
  fullDbName: string;
  dbUser: string;
};
export const createKubernetesCloudsqlBaseValues = (
  context: Context
): {
  cloudsql: CloudSqlValues;
} => {
  if (!isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    throw new Error("cannot get cloud sql config");
  }

  const config = context.componentConfig.deploy.values?.cloudsql;

  if (!config) {
    throw new Error("cannot get cloud sql config");
  }

  const proxyCredentials = `$${getSecretVarNameForContext(
    context,
    "cloudsqlProxyCredentials"
  )}`;
  if (config?.type !== "unmanaged") {
    const instanceConnectionName = `${config.projectId ?? "skynet-164509"}:${
      config.region ?? "europe-west6"
    }:${config.instanceId ?? context.environment.envVars.KUBE_NAMESPACE}`;

    return {
      cloudsql: {
        enabled: config.enabled,
        dbUser: "postgres",
        instanceConnectionName,
        proxyCredentials,
        fullDbName: context.environment.envVars.KUBE_APP_NAME,
      },
    };
  } else if (config.type === "unmanaged") {
    return {
      cloudsql: {
        enabled: config.enabled,
        dbUser: config.dbUser ?? "postgres",
        instanceConnectionName: config.instanceConnectionName,
        proxyCredentials,
        fullDbName: getFullDbName(
          config,
          context.fullConfig,
          context.environment.slugPrefix,
          context.componentName
        ),
      },
    };
  } else {
    throw new Error("unknonw type");
  }
};
