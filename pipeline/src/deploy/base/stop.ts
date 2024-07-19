import type { ComponentContext } from "../../types/context";
import type { StopJobDefinition } from "../../types/jobDefinition";
import type { CatladderJob } from "../../types/jobs";

import { DEPLOY_RUNNER_VARIABLES } from "./variables";
export const STOP_JOB_NAME = "🛑 Stop ⚠️";

export const createStopJob = (
  context: ComponentContext,
  jobDefinition: StopJobDefinition,
): CatladderJob => {
  return {
    name: STOP_JOB_NAME,
    image: jobDefinition.image,
    envMode: "stagePerEnv", // makes it easier to run manual tasks er env
    needs: [], // can be executed even if the deploy job failed
    allow_failure: true,
    when: "manual", // stop is always manual
    rules: [
      {
        if: "$CI_COMMIT_BRANCH =~ /^[0-9]+\\.([0-9]+|x)\\.x$/", // automatic on hotfix branches
        when: "on_success",
      },
    ],
    variables: {
      ...context.environment.jobOnlyVars.deploy.envVars,
      ...jobDefinition.variables,
    },
    runnerVariables: {
      ...DEPLOY_RUNNER_VARIABLES,
      GIT_STRATEGY: "none",
      ...jobDefinition.runnerVariables,
    },
    stage: "stop",
    environment: {
      action: "stop",
    },
    script: jobDefinition.script,
  };
};
