import { merge } from "lodash";

import { getYarnInstall } from "../../build/node/yarn";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
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

  const yarnInstall = getYarnInstall(context);
  return [
    merge({}, baseDeploymentJob, {
      script: [
        `cd ${context.componentConfig.dir}`,
        ...(deployConfig.requiresYarnInstall ? yarnInstall : []),
        ...deployConfig.script,
      ],
    }),
  ];
};
