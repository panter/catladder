import { getAllEnvsByTrigger } from "../config";
import { createComponentContext } from "../context";
import type {
  ComponentContext,
  Config,
  PipelineTrigger,
  PipelineType,
} from "../types";
import type { CatladderJob } from "../types/jobs";
import { createJobsForComponentContext } from "./createJobsForComponent";

export type AllCatladderJobs = Array<{
  context: ComponentContext;
  jobs: Array<CatladderJob>;
}>;

export type AllJobsContext = {
  config: Config;
  trigger: PipelineTrigger;
  pipelineType: PipelineType;
};

const createAllComponentContext = async ({
  config,
  trigger,
  pipelineType,
}: AllJobsContext): Promise<
  Array<{
    env: string;
    componentName: string;
    context: ComponentContext;
  }>
> => {
  return await Promise.all(
    Object.keys(config.components).flatMap((componentName) => {
      const envs = getAllEnvsByTrigger(config, componentName, trigger);
      return envs.map(async (env) => {
        const context = await createComponentContext({
          config,
          componentName,
          env,
          trigger,
          pipelineType,
        });

        return {
          env,
          componentName,
          context,
        };
      });
    }),
  );
};

export const createAllJobs = async ({
  config,
  trigger,
  pipelineType,
}: AllJobsContext): Promise<AllCatladderJobs> => {
  const allComponentContext = await createAllComponentContext({
    config,
    trigger,
    pipelineType,
  });

  return allComponentContext.map(({ context }) => ({
    context,
    jobs: createJobsForComponentContext(context),
  }));
};
