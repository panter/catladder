import type { Context } from "../../types/context";
import type { JobWithoutScript } from "./types";
import { DEPLOY_RUNNER_VARIABLES } from "./variables";

export const ROLLBACK_JOB_NAME = "↩️ Rollback ⚠️";

export const getBaseRollbackJob = (context: Context): JobWithoutScript => {
  return {
    name: ROLLBACK_JOB_NAME,
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env
    needs: [], // can be executed even if the deploy job failed
    rules: [
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
    stage: "rollback",
    environment: {
      ...context.environment.gitlabEnvironment,
      action: "access",
    },
  };
};
