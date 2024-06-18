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

type AllComponentContext = {
  [componentName: string]: {
    [env: string]: ComponentContext;
  };
};

const createAllComponentContext = async ({
  config,
  trigger,
  pipelineType,
}: AllJobsContext): Promise<AllComponentContext> => {
  return Object.fromEntries(
    await Promise.all(
      Object.keys(config.components).map(async (componentName) => {
        const envs = getAllEnvsByTrigger(config, componentName, trigger);
        return [
          componentName,
          Object.fromEntries(
            await Promise.all(
              envs.map(async (env) => {
                const context = await createComponentContext({
                  config,
                  componentName,
                  env,
                  trigger,
                  pipelineType,
                });

                return [env, context];
              }),
            ),
          ),
        ];
      }),
    ),
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

  return Object.fromEntries(
    Object.entries(allComponentContext).map(([componentName, envs]) => [
      componentName,
      Object.fromEntries(
        Object.entries(envs).map(([env, context]) => [
          env,
          createJobsForComponentContext(context).map((job) => ({
            ...job,
            context,
          })),
        ]),
      ),
    ]),
  );
};
