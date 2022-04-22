import { merge } from "lodash";
import { Context } from "../../types/context";
import { CatladderJob } from "../../types/jobs";
import { getBaseDeploymentJob } from "../base";
import { isOfDeployType } from "../types";

export const createCustomDeployJobs = (context: Context): CatladderJob[] => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "custom")) {
    // should not happen
    throw new Error("deploy config is not custom");
  }
  const baseDeploymentJob = getBaseDeploymentJob(context);

  return [
    merge({}, baseDeploymentJob, {
      script: [`cd ${context.componentConfig.dir}`, ...deployConfig.script],
    }),
  ];
};
