import { merge } from "lodash-es";
import type {
  BuildContextStandalone,
  ComponentContext,
  WorkspaceContext,
} from "../..";
import { getRunnerImage } from "../..";
import type { AppBuildJobDefinition } from "../../types/jobDefinition";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray } from "../../utils";
import { createBuildJobArtifacts } from "../artifacts/createBuildJobArtifact";
import { createJobCacheFromCacheConfigs } from "../cache/createJobCache";
import { ensureNodeVersion } from "../node/yarn";
import {
  APP_BUILD_JOB_NAME,
  RUNNER_BUILD_RESOURCE_VARIABLES,
} from "./constants";
import { writeBuildInfo } from "./writeBuildInfo";
import {
  componentContextNeedsBuildTimeDotEnv,
  writeDotEnv,
} from "./writeDotEnv";

export const createAppBuildJob = async (
  context: ComponentContext<BuildContextStandalone> | WorkspaceContext,
  { script, variables, runnerVariables, cache, ...def }: AppBuildJobDefinition,
): Promise<CatladderJob> => {
  return merge(
    {
      name: APP_BUILD_JOB_NAME,
      envMode: "jobPerEnv",
      stage: "build",
      image: getRunnerImage("jobs-default"),
      needs: [],
      cache: cache ? createJobCacheFromCacheConfigs(context, cache) : undefined,
      variables: {
        ...(variables ?? {}),
        ...(context.type === "component"
          ? {
              ...context.environment.envVars,
              ...context.environment.jobOnlyVars.build.envVars,
            }
          : {}),
      },
      runnerVariables: {
        ...RUNNER_BUILD_RESOURCE_VARIABLES,
        ...(runnerVariables ?? {}),
        ...(context.build.config.runnerVariables ?? {}),
      },

      script: [
        ...(context.type === "component"
          ? componentContextNeedsBuildTimeDotEnv(context)
            ? writeDotEnv(context)
            : []
          : context.type === "workspace"
            ? context.components
                .filter((c) => componentContextNeedsBuildTimeDotEnv(c))
                .flatMap((c) => writeDotEnv(c))
            : []),
        ...(context.type === "component" ? writeBuildInfo(context) : []),
        ...ensureNodeVersion(context), // in pure node repos, we might want to have the nvmrc file in top-level
        `cd ${context.build.dir}`,
        ...ensureArray(script),
      ],
      artifacts: await createBuildJobArtifacts(context),
    },
    def,
  );
};
