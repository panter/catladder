import { merge } from "lodash";
import { Context, GitlabJob, GitlabJobDef } from "../..";
import { BASE_RETRY } from "../../defaults";
import { ensureArray } from "../../utils";
import {
  APP_BUILD_JOB_NAME,
  RUNNER_BUILD_RESOURCE_VARIABLES,
} from "./constants";

export const createBuildJob = (
  context: Context,
  { script, ...def }: Partial<GitlabJobDef>
): GitlabJob => {
  const buildInfo = [
    ". getCommitInfo", // TODO: inline
    `echo '{"id":"'$BUILD_ID'","commit":"'$BUILD_COMMIT'","tag":"'$BUILD_TAG'","time":"'$BUILD_TIME'"}' > ${context.componentConfig.dir}/__build_info.json`,
  ];

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
          ...buildInfo,
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
