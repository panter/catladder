import type { ComponentContext } from "../../types/context";
import type { StopJobDefinition } from "../../types/jobDefinition";
import { CatladderJob } from "../../types/jobs";

import { DEPLOY_RUNNER_VARIABLES } from "./variables";
export const STOP_JOB_NAME = "🛑 Stop ⚠️";

export class StopJob extends CatladderJob {
  constructor(context: ComponentContext, jobDefinition: StopJobDefinition) {
    super({
      name: STOP_JOB_NAME,
      image: jobDefinition.image,
      envMode: "stagePerEnv", // makes it easier to run manual tasks er env
      needs: [], // can be executed even if the deploy job failed
      allow_failure: true,
      when: "manual", // stop is always manual
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
    });
  }
}
