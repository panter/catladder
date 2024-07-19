import type { ComponentContext } from "../../types/context";
import type {
  DeployJobDefinition,
  RollbackJobDefinition,
  StopJobDefinition,
} from "../../types/jobDefinition";
import type { CatladderJob } from "../../types/jobs";
import { createDeployJob } from "./deploy";
import { createRollbackJob } from "./rollback";
import { createStopJob } from "./stop";

export const createDeployementJobs = (
  context: ComponentContext,
  definitions: {
    deploy: DeployJobDefinition;
    stop?: StopJobDefinition;
    rollback?: RollbackJobDefinition;
  },
): CatladderJob[] => {
  return [
    createDeployJob(context, definitions.deploy),
    ...(definitions.stop ? [createStopJob(context, definitions.stop)] : []),
    ...(definitions.rollback
      ? [createRollbackJob(context, definitions.rollback)]
      : []),
  ];
};
