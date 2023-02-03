import { getAllEnvsByTrigger } from "../config";
import type { Config, PipelineTrigger } from "../types";
import type { CatladderJob } from "../types/jobs";
import { createJobsForComponent } from "./createJobsForComponent";

export type AllCatladderJobs = {
  [componentName: string]: {
    [env: string]: Array<CatladderJob>;
  };
};
export const createAllJobs = async (
  config: Config,
  trigger: PipelineTrigger
): Promise<AllCatladderJobs> => {
  return Object.fromEntries(
    await Promise.all(
      Object.keys(config.components).map(async (componentName) => {
        const envs = getAllEnvsByTrigger(config, componentName, trigger);
        return [
          componentName,
          Object.fromEntries(
            await Promise.all(
              envs.map(async (env) => [
                env,
                await createJobsForComponent(
                  config,
                  componentName,
                  env,
                  trigger
                ),
              ])
            )
          ),
        ];
      })
    )
  );
};
