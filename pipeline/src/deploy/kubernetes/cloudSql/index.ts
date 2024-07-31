import type { StringOrBashExpression } from "../../../bash/BashExpression";
import { getSecretVarNameForContext } from "../../../context";
import type { ComponentContext } from "../../../types";
import type { VariableValue } from "../../../variables/VariableValue";
import { getFullDbName } from "../../cloudSql/utils";
import { isOfDeployType } from "../../types";

export const hasKubernetesCloudSQL = (context: ComponentContext) => {
  const deployConfig = context.deploy?.config;

  if (isOfDeployType(deployConfig, "kubernetes")) {
    return deployConfig.values?.cloudsql?.enabled;
  }
  return false;
};

type CloudSqlValues = {
  enabled: boolean;
  proxyCredentials: string;

  instanceConnectionName: string;
  fullDbName: VariableValue;
  dbUser: string;
};
export const createKubernetesCloudsqlBaseValues = (
  context: ComponentContext,
): {
  cloudsql: CloudSqlValues;
} => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "kubernetes")) {
    throw new Error("cannot get cloud sql config");
  }

  const config = deployConfig.values?.cloudsql;

  if (!config) {
    throw new Error("cannot get cloud sql config");
  }

  const proxyCredentials = `$${getSecretVarNameForContext(
    context,
    "cloudsqlProxyCredentials",
  )}`;
  if (config.type === "unmanaged") {
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
          context.name,
        ),
      },
    };
  } else {
    throw new Error("unknonw type");
  }
};
