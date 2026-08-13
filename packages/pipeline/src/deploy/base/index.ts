import type { ComponentContext } from "../../types/context";
import type {
  DeployJobDefinition,
  RollbackJobDefinition,
  StopJobDefinition,
} from "../../types/jobDefinition";
import type { CatladderJob } from "../../types/jobs";
import { DeployJob } from "./deploy";
import { RollbackJob } from "./rollback";
import { StopJob } from "./stop";

export const createDeployementJobs = (
  context: ComponentContext,
  definitions: {
    deploy: DeployJobDefinition;
    stop?: StopJobDefinition;
    rollback?: RollbackJobDefinition;
  },
): CatladderJob[] => {
  return [
    new DeployJob(context, definitions.deploy),
    ...(definitions.stop ? [new StopJob(context, definitions.stop)] : []),
    ...(definitions.rollback
      ? [new RollbackJob(context, definitions.rollback)]
      : []),
  ];
};
