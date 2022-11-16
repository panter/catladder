import { getSecretVarNameForContext } from "../../../context";
import type { Context } from "../../../types";
import { isOfDeployType } from "../../types";

export const hasKubernetesCloudSQL = (context: Context) => {
  if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    return context.componentConfig.deploy.values?.cloudsql?.enabled;
  }
  return false;
};

export const getKubernetesCloudSQLConfig = (context: Context) => {
  if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    return context.componentConfig.deploy.values?.cloudsql;
  }
  throw new Error("cannot get cloud sql config");
};

export const createCloudsqlBaseConfig = (context: Context) => {
  return {
    cloudsql: {
      proxyCredentials: `$${getSecretVarNameForContext(
        context,
        "cloudsqlProxyCredentials"
      )}`,
    },
  };
};
