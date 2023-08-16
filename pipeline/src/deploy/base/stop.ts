import type { Context } from "../../types/context";
import type { JobWithoutScript } from "./types";
import { DEPLOY_RUNNER_VARIABLES } from "./variables";
export const STOP_JOB_NAME = "🛑 Stop ⚠️";

export const getBaseDeploymentStopJob = (
  context: Context
): JobWithoutScript => {
  return {
    name: STOP_JOB_NAME,
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
    },
    stage: "stop",
    environment: {
      ...context.environment.gitlabEnvironment,
      action: "stop",
    },
  };
};
