import { merge } from "lodash";
import { join } from "path";
import type { Context } from "../..";
import { getRunnerImage } from "../..";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray } from "../../utils";
import { ensureNodeVersion } from "../node/yarn";
import {
  APP_BUILD_JOB_NAME,
  RUNNER_BUILD_RESOURCE_VARIABLES,
} from "./constants";
import { writeBuildInfo } from "./writeBuildInfo";
import { writeDotEnv } from "./writeDotEnv";

export type AppBuildJobDefinition = Partial<CatladderJob>;
export const createAppBuildJob = (
  context: Context,
  { script, variables, ...def }: AppBuildJobDefinition
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
        ...RUNNER_BUILD_RESOURCE_VARIABLES,
        ...(variables ?? {}),
        ...context.environment.envVars,
        ...context.environment.jobOnlyVars.build.envVars,
        ...(context.componentConfig.build.extraVars ?? {}),
      },

      script: [
        ...(context.componentConfig.dotEnv === true // don't build when set to `local`
          ? writeDotEnv(context)
          : []),
        ...writeBuildInfo(context),
        ...ensureNodeVersion(context), // in pure node repos, we might want to have the nvmrc file in top-level
        `cd ${context.componentConfig.dir}`,
        ...(ensureArray(script) ?? []),
      ],
      artifacts: {
        paths: [join(context.componentConfig.dir, "__build_info.json")],
        reports: {
          junit: context.componentConfig.build.artifactsReports?.junit?.map(
            (p) => join(context.componentConfig.dir, p)
          ),
        },
      },
    },
    def
  );
};
