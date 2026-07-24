import { getAllCacheConfigsFromConfig } from "../../build/cache/getAllCacheConfigsFromConfig";
import { getYarnInstall } from "../../build/node/yarn";
import { getRunnerImage } from "../../runner";
import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createDeployementJobs } from "../base";

import { isOfDeployType } from "../types";

export const createCustomDeployJobs = async (
  context: ComponentContext,
): Promise<CatladderJob[]> => {
  const deployConfig = context.deploy?.config;

  if (!isOfDeployType(deployConfig, "custom")) {
    // should not happen
    throw new Error("deploy config is not custom");
  }
  // FIXME: custom deploy currently assumes yarn-based project
  const yarnInstall = await getYarnInstall(context, {
    noCustomPostInstall: true,
  });

  const result = createDeployementJobs(context, {
    deploy: {
      image: deployConfig.jobImage ?? getRunnerImage("jobs-default"),
      cache: getAllCacheConfigsFromConfig(context, deployConfig),
      script: [
        `cd ${context.build.dir}`,
        ...(deployConfig.requiresYarnInstall ? yarnInstall : []),
        ...deployConfig.script,
      ],
      variables: {},
    },
    stop: deployConfig.stopScript
      ? {
          image: deployConfig.jobImage ?? getRunnerImage("jobs-default"),
          script: [...deployConfig.stopScript],
          variables: {},
        }
      : undefined,
  });
  return result;
};
