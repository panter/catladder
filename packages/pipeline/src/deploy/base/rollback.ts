import type { ComponentContext } from "../../types/context";
import type { RollbackJobDefinition } from "../../types/jobDefinition";
import { CatladderJob } from "../../types/jobs";
import { DEPLOY_RUNNER_VARIABLES } from "./variables";

export const ROLLBACK_JOB_NAME = "↩️ Rollback ⚠️";

export class RollbackJob extends CatladderJob {
  constructor(context: ComponentContext, jobDefinition: RollbackJobDefinition) {
    super({
      name: ROLLBACK_JOB_NAME,
      image: jobDefinition.image,
      envMode: "stagePerEnv", // makes it easier to run manual tasks er env
      needs: [], // can be executed even if the deploy job failed
      gate: "manual",
      variables: {
        ...context.environment.jobOnlyVars.deploy.envVars,
        ...jobDefinition.variables,
      },
      runnerVariables: {
        ...DEPLOY_RUNNER_VARIABLES,
        GIT_STRATEGY: "none",
        ...(jobDefinition.runnerVariables ?? {}),
      },
      stage: "rollback",
      environment: {
        action: "access",
      },

      script: jobDefinition.script,
    });
  }
}
