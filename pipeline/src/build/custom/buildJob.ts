import type { ComponentContextWithBuild } from "../../types/context";
import { getDockerBuildScriptWithBuiltInDockerFile } from "../docker";
import { isOfBuildType } from "../types";

import type { CatladderJob } from "../../types/jobs";
import { createComponentBuildJobs } from "../base";
import { createBuildJobDefinition } from "../base/createBuildJobDefinition";

export const createCustomBuildJobs = (
  context: ComponentContextWithBuild,
): CatladderJob[] => {
  const buildConfig = context.build.config;

  if (!isOfBuildType(buildConfig, "custom")) {
    throw new Error("deploy config is not custom");
  }

  return createComponentBuildJobs(context, {
    appBuild:
      buildConfig.buildCommand !== null && buildConfig.buildCommand !== false
        ? createBuildJobDefinition(context, buildConfig)
        : undefined,
    dockerBuild: {
      script: getDockerBuildScriptWithBuiltInDockerFile(context),

      variables: {},
    },
  });
};
