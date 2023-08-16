import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { DEPLOY_RUNNER_VARIABLES } from "./variables";

export const ROLLBACK_JOB_NAME = "↩️ Rollback ⚠️";

export type RollbackJobDefinition = Pick<
  CatladderJob,
  "script" | "variables" | "image"
>;
export const createRollbackJob = (
  context: Context,
  jobDefinition: RollbackJobDefinition
): CatladderJob => {
  return {
    name: ROLLBACK_JOB_NAME,
    image: jobDefinition.image,
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
      ...jobDefinition.variables,
    },
    stage: "rollback",
    environment: {
      ...context.environment.gitlabEnvironment,
      action: "access",
    },

    script: jobDefinition.script,
  };
};
