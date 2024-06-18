import { getAllEnvsByTrigger } from "../config";
import { createComponentContext } from "../context";
import type {
  CatladderJobWithContext,
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

export const createAllJobs = async ({
  config,
  trigger,
  pipelineType,
}: AllJobsContext): Promise<AllCatladderJobs> => {
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

                return [
                  env,
                  createJobsForComponentContext(context).map((job) => ({
                    ...job,
                    context,
                  })),
                ];
              }),
            ),
          ),
        ];
      }),
    ),
  );
};
