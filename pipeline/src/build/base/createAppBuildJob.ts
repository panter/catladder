import { merge } from "lodash";
import { join } from "path";
import type { ComponentContext } from "../..";
import { getRunnerImage } from "../..";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray } from "../../utils";
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

export type AppBuildJobDefinition = Partial<CatladderJob>;
export const createAppBuildJob = (
  context: ComponentContext,
  { script, variables, runnerVariables, ...def }: AppBuildJobDefinition,
): CatladderJob => {
  return merge(
    {
      name: APP_BUILD_JOB_NAME,
      envMode: "jobPerEnv",
      stage: "build",
      image: getRunnerImage("jobs-default"),
      needs: [],
      cache: [],
      variables: {
        ...(variables ?? {}),
        ...context.environment.envVars,
        ...context.environment.jobOnlyVars.build.envVars,
        ...(context.build.config.extraVars ?? {}),
      },
      runnerVariables: {
        ...RUNNER_BUILD_RESOURCE_VARIABLES,
        ...(runnerVariables ?? {}),
        ...(context.build.config.runnerVariables ?? {}),
      },

      script: [
        ...(componentContextNeedsBuildTimeDotEnv(context)
          ? writeDotEnv(context)
          : []),
        ...writeBuildInfo(context),
        ...ensureNodeVersion(context.build), // in pure node repos, we might want to have the nvmrc file in top-level
        `cd ${context.build.dir}`,
        ...(ensureArray(script) ?? []),
      ],
      artifacts: {
        paths: [join(context.build.dir, "__build_info.json")],
        reports: {
          junit: context.build.config.artifactsReports?.junit?.map((p) =>
            join(context.build.dir, p),
          ),
        },
      },
    },
    def,
  );
};
