import { isFunction } from "lodash";
import { BUILD_TYPES } from "../build";
import type { BuildConfig, BuildConfigType } from "../build/types";
import { DEPLOY_TYPES } from "../deploy";
import type { DeployConfig, DeployConfigType } from "../deploy/types";
import type { PipelineType } from "../types";
import type { Config, PipelineTrigger } from "../types/config";
import type { ComponentContext, PackageManagerInfo } from "../types/context";
import type { PartialDeep } from "../types/utils";
import { mergeWithMergingArrays } from "../utils";
import { getEnvironment } from "./getEnvironment";
import { getEnvironmentContext } from "./getEnvironmentContext";

export * from "./getEnvironment";
export * from "./getEnvironmentVariables";

export type CreateComponentContextContext = {
  config: Config;
  componentName: string;
  env: string;
  pipelineType?: PipelineType;
  trigger?: PipelineTrigger;
  packageManagerInfo?: PackageManagerInfo;
};

export const createComponentContext = async (
  ctx: CreateComponentContextContext,
): Promise<ComponentContext> => {
  if (!/^[a-z0-9-]+$/.test(ctx.componentName)) {
    throw new Error(
      "componentName may only contain lower case letters, numbers and -",
    );
  }

  const envContext = getEnvironmentContext(ctx);

  const componentConfigWithoutDefaults = envContext.envConfigRaw;
  const defaults: {
    build: PartialDeep<BuildConfig>;
    deploy: PartialDeep<DeployConfig>;
  } = componentConfigWithoutDefaults.deploy
    ? {
        build:
          BUILD_TYPES[
            componentConfigWithoutDefaults.build.type as BuildConfigType
          ].defaults(envContext),
        deploy: DEPLOY_TYPES[
          componentConfigWithoutDefaults.deploy.type as DeployConfigType
        ].defaults(envContext as any),
      }
    : {
        build: {},
        deploy: {},
      };
  const componentConfig = mergeWithMergingArrays(
    defaults,
    componentConfigWithoutDefaults,
  );

  const environment = await getEnvironment(ctx);
  const { deploy, build, customJobs, dir } = componentConfig;
  const context: Omit<ComponentContext, "customJobs"> = {
    fullConfig: ctx.config,
    componentConfig,

    build: {
      dir: dir,
      packageManagerInfo: ctx.packageManagerInfo,
      config: build,
    },
    deploy: deploy
      ? {
          config: deploy,
        }
      : null,
    componentName: ctx.componentName,
    environment,
    packageManagerInfo: ctx.packageManagerInfo,
    pipelineType: ctx.pipelineType,
    trigger: ctx.trigger,
  };
  const resolvedCustomJobs = isFunction(customJobs)
    ? customJobs(context)
    : customJobs;
  return {
    ...context,
    customJobs: resolvedCustomJobs,
  };
};

/**
 * @deprecated use createComponentContext instead
 */
export const createContext = createComponentContext;
