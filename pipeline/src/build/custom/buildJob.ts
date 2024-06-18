import type { ComponentContext } from "../../types/context";
import { ensureArray } from "../../utils";
import { getDockerBuildScriptWithBuiltInDockerFile } from "../docker";
import { isOfBuildType } from "../types";

import type { CatladderJob } from "../../types/jobs";
import { createComponentBuildJobs } from "../base";

const RUNNER_BUILD_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.5",
  KUBERNETES_MEMORY_REQUEST: "2Gi",
  KUBERNETES_MEMORY_LIMIT: "4Gi",
};

export const createCustomBuildJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  const buildConfig = context.build.config;

  if (!isOfBuildType(buildConfig, "custom")) {
    throw new Error("deploy config is not custom");
  }

  return createComponentBuildJobs(context, {
    appBuild:
      buildConfig.buildCommand !== null
        ? {
            image: buildConfig.jobImage,
            runnerVariables: RUNNER_BUILD_VARIABLES,
            cache: buildConfig.jobCache,
            services: buildConfig.jobServices,
            script: [...(ensureArray(buildConfig.buildCommand) ?? [])],
          }
        : undefined,
    dockerBuild: {
      script: getDockerBuildScriptWithBuiltInDockerFile(context),

      variables: {},
    },
  });
};
