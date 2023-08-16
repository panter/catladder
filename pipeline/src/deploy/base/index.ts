import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createDeployJob, type DeployJobDefinition } from "./deploy";
import { createRollbackJob, type RollbackJobDefinition } from "./rollback";
import { createStopJob, type StopJobDefinition } from "./stop";

export const createDeployementJobs = (
  context: Context,
  definitions: {
    deploy: DeployJobDefinition;
    stop?: StopJobDefinition;
    rollback?: RollbackJobDefinition;
  }
): CatladderJob[] => {
  return [
    createDeployJob(context, definitions.deploy),
    ...(definitions.stop ? [createStopJob(context, definitions.stop)] : []),
    ...(definitions.rollback
      ? [createRollbackJob(context, definitions.rollback)]
      : []),
  ];
};
