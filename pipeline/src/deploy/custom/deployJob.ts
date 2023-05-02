import { merge } from "lodash";

import { getYarnInstall } from "../../build/node/yarn";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { getBaseDeploymentJob, getBaseDeploymentStopJob } from "../base";
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
  // FIXME: custom deploy currently assumes yarn-based project
  const yarnInstall = getYarnInstall(context, { noCustomPostInstall: true });
  return [
    merge({}, baseDeploymentJob, {
      image: deployConfig.jobImage ?? getRunnerImage("jobs-default"),
      cache: deployConfig.jobCache ?? [],
      script: [
        `cd ${context.componentConfig.dir}`,
        ...(deployConfig.requiresYarnInstall ? yarnInstall : []),
        ...deployConfig.script,
      ],
    }),
    ...(deployConfig.stopScript
      ? [
          merge({}, getBaseDeploymentStopJob(context), {
            image: deployConfig.jobImage ?? getRunnerImage("jobs-default"),
            script: deployConfig.stopScript,
          }),
        ]
      : []),
  ];
};
