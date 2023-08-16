import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";

import { DEPLOY_RUNNER_VARIABLES } from "./variables";
export const STOP_JOB_NAME = "🛑 Stop ⚠️";

export type StopJobDefinition = Pick<
  CatladderJob,
  "script" | "variables" | "image"
>;
export const createStopJob = (
  context: Context,
  jobDefinition: StopJobDefinition
): CatladderJob => {
  return {
    name: STOP_JOB_NAME,
    image: jobDefinition.image,
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env
    needs: [], // can be executed even if the deploy job failed
    rules: [
      {
        if: "$CI_COMMIT_BRANCH =~ /^[0-9]+\\.([0-9]+|x)\\.x$/", // automatic on hotfix branches
        when: "on_success",
        allow_failure: true,
      },
      {
        when: "manual",
        allow_failure: true,
      },
    ],
    variables: {
      ...DEPLOY_RUNNER_VARIABLES,
      ...context.environment.jobOnlyVars.deploy.envVars,
      GIT_STRATEGY: "none",
      ...jobDefinition.variables,
    },
    stage: "stop",
    environment: {
      ...context.environment.gitlabEnvironment,
      action: "stop",
    },
    script: jobDefinition.script,
  };
};
