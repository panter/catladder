import { merge } from "lodash";
import { BuildConfigType, BuildTypes } from "../..";
import { getYarnInstall } from "../../build/node/yarn";
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

  const yarnInstall = getYarnInstall(context);
  return [
    merge({}, baseDeploymentJob, {
      script: [
        `cd ${context.componentConfig.dir}`,
        ...(requiresYarnInstall(context) ? yarnInstall : []),
        ...deployConfig.script,
      ],
    }),
  ];
};

const buildTypesThatRequireYarn: BuildConfigType[] = [
  "meteor",
  "node",
  "node-static",
  "storybook",
];

const requiresYarnInstall = (context: Context) => {
  const buildConfig = context.componentConfig.build;

  return buildTypesThatRequireYarn.includes(buildConfig.type);
};
