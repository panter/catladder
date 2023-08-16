import { join } from "path";
import type { Context } from "../../types/context";
import { ensureArray } from "../../utils";
import { getDockerBuildDefaultScript, requiresDockerBuild } from "../docker";
import { isOfBuildType } from "../types";

import type { CatladderJob } from "../../types/jobs";
import { createBuildJobs } from "../base";

const RUNNER_BUILD_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.5",
  KUBERNETES_CPU_LIMIT: "2",
  KUBERNETES_MEMORY_REQUEST: "2Gi",
  KUBERNETES_MEMORY_LIMIT: "4Gi",
};

export const createCustomBuildJobs = (context: Context): CatladderJob[] => {
  const buildConfig = context.componentConfig.build;

  if (!isOfBuildType(buildConfig, "custom")) {
    throw new Error("deploy config is not custom");
  }

  return createBuildJobs(context, {
    appBuild:
      buildConfig.buildCommand !== null
        ? {
            image: buildConfig.jobImage,
            variables: {
              ...RUNNER_BUILD_VARIABLES,
            },
            cache: buildConfig.jobCache,
            services: buildConfig.jobServices,
            script: [...(ensureArray(buildConfig.buildCommand) ?? [])],
            artifacts: {
              paths: [
                join(context.componentConfig.dir, "__build_info.json"),
                join(context.componentConfig.dir, "dist"),
                ...(buildConfig.artifactsPaths?.map((path) =>
                  join(context.componentConfig.dir, path)
                ) ?? []),
              ],
              expire_in: "1 day",
            },
          }
        : undefined,
    dockerBuild: {
      script: getDockerBuildDefaultScript(
        buildConfig.docker?.type === "nginx" ? "ensureNginxDockerfile" : ""
      ),

      variables: {},
    },
  });
};
