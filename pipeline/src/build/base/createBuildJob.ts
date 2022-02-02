import { merge } from "lodash";
import { Context, GitlabJob, GitlabJobDef } from "../..";
import { BASE_RETRY } from "../../defaults";
import { ensureArray } from "../../utils";
import {
  APP_BUILD_JOB_NAME,
  RUNNER_BUILD_RESOURCE_VARIABLES,
} from "./constants";
import { getBuildInfo } from "./getBuildInfo";

export const createBuildJob = (
  context: Context,
  { script, ...def }: Partial<GitlabJobDef>
): GitlabJob => {
  return {
    name: APP_BUILD_JOB_NAME,
    envMode: "jobPerEnv",
    job: merge(
      {
        needs: [],
        cache: [],
        variables: {
          ...RUNNER_BUILD_RESOURCE_VARIABLES,
          ...context.environment.envVars,
          ...(context.componentConfig.build.extraVars ?? {}),
        },
        retry: BASE_RETRY,
        interruptible: true,
        stage: "build",
        script: [
          ...getBuildInfo(context),
          `cd ${context.componentConfig.dir}`,
          ...(ensureArray(script) ?? []),
        ],
        artifacts: {
          paths: [context.componentConfig.dir + "/__build_info.json"],
        },
      },
      def
    ),
  };
};
