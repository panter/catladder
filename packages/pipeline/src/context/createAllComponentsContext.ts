import { getAllEnvsByTrigger } from "../config/configruedEnvs";
import type { ComponentContext, PipelineType } from "../types";
import type { Config, EnvPipelineTrigger } from "../types/config";
import { createComponentContext } from "./createComponentContext";

export type CreateAllComponentsContextProps = {
  config: Config;
  trigger: EnvPipelineTrigger;
  pipelineType: PipelineType;
};

export const createAllComponentsContext = async ({
  config,
  trigger,
  pipelineType,
}: CreateAllComponentsContextProps): Promise<Array<ComponentContext>> => {
  return await Promise.all(
    Object.keys(config.components).flatMap((componentName) => {
      const envs = getAllEnvsByTrigger(config, componentName, trigger);
      return envs.map(async (env) => {
        return await createComponentContext({
          config,
          componentName,
          env,
          trigger,
          pipelineType,
        });
      });
    }),
  );
};
