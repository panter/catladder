import { getAllEnvsByTrigger } from "../config";
import { createComponentContext } from "../context";
import type {
  CatladderJobWithContext,
  ComponentContext,
  Config,
  PipelineTrigger,
  PipelineType,
} from "../types";
import { createJobsForComponentContext } from "./createJobsForComponent";

export type AllCatladderJobs = {
  [componentName: string]: {
    [env: string]: Array<CatladderJobWithContext>;
  };
};

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

  return allComponentContext.reduce((acc, { componentName, env, context }) => {
    if (!acc[componentName]) {
      acc[componentName] = {};
    }
    acc[componentName][env] = createJobsForComponentContext(context).map(
      (job) => ({
        ...job,
        context,
      }),
    );

    return acc;
  }, {} as AllCatladderJobs);
};
