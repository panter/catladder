import { join } from "path";
import type { Context } from "../../types/context";
import { ensureArray } from "../../utils";
import { APP_BUILD_JOB_NAME } from "../base/constants";
import { createBuildJob } from "../base/createBuildJob";
import { createDockerBuildJobDefault, requiresDockerBuild } from "../docker";
import { isOfBuildType } from "../types";

import type { CatladderJob } from "../../types/jobs";

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

  const appBuildJob: CatladderJob | null =
    buildConfig.buildCommand !== null
      ? createBuildJob(context, {
          image: buildConfig.jobImage,
          variables: {
            ...RUNNER_BUILD_VARIABLES,
          },
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
          },
        })
      : null;
  return [
    ...(appBuildJob ? [appBuildJob] : []),
    ...(requiresDockerBuild(context)
      ? [
          createDockerBuildJobDefault(context, {
            script: [
              buildConfig.docker?.type === "nginx"
                ? "ensureNginxDockerfile"
                : "", // e.g. custom,
            ].filter(Boolean),

            variables: {},

            needs: appBuildJob ? [APP_BUILD_JOB_NAME] : [],
          }),
        ]
      : []),
  ];
};
