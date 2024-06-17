import { getYarnInstall } from "../../build/node/yarn";
import { getRunnerImage } from "../../runner";
import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createDeployementJobs } from "../base";
import {
  getDependencyTrackDeleteScript,
  getDependencyTrackUploadScript,
} from "../sbom";
import { isOfDeployType } from "../types";

export const createCustomDeployJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "custom")) {
    // should not happen
    throw new Error("deploy config is not custom");
  }
  // FIXME: custom deploy currently assumes yarn-based project
  const yarnInstall = getYarnInstall(context, { noCustomPostInstall: true });
  return createDeployementJobs(context, {
    deploy: {
      image: deployConfig.jobImage ?? getRunnerImage("jobs-default"),
      cache: deployConfig.jobCache ?? [],
      script: [
        `cd ${context.componentConfig.dir}`,
        ...(deployConfig.requiresYarnInstall ? yarnInstall : []),
        ...deployConfig.script,
        ...getDependencyTrackUploadScript(context),
      ],
      variables: {},
    },
    stop: deployConfig.stopScript
      ? {
          image: deployConfig.jobImage ?? getRunnerImage("jobs-default"),
          script: [
            ...deployConfig.stopScript,
            ...getDependencyTrackDeleteScript(context),
          ],
          variables: {},
        }
      : undefined,
  });
};
