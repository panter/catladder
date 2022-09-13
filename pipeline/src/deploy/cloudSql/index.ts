import type { Context } from "../../types";
import { isOfDeployType } from "../types";

export const hasCloudSQL = (context: Context) => {
  if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    return context.componentConfig.deploy.values?.cloudsql?.enabled;
  }
  return false;
};

export const getCloudSQLConfig = (context: Context) => {
  if (isOfDeployType(context.componentConfig.deploy, "kubernetes")) {
    return context.componentConfig.deploy.values?.cloudsql;
  }
  throw new Error("cannot get cloud sql config");
};
