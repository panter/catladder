import { isFunction } from "lodash";
import { BUILD_TYPES, isStandaloneBuildConfig } from "../build";
import type { BuildConfig } from "../build/types";
import { DEPLOY_TYPES } from "../deploy";
import type { DeployConfig, DeployConfigType } from "../deploy/types";
import { getPackageManagerInfoForComponent } from "../pipeline/packageManager";
import type { PipelineType } from "../types";
import type { Config, PipelineTrigger } from "../types/config";
import type {
  BuildContext,
  BuildContextComponent,
  ComponentContext,
} from "../types/context";
import type { PartialDeep } from "../types/utils";
import { mergeWithMergingArrays } from "../utils";
import { getEnvironment } from "./getEnvironment";
import { getEnvironmentContext } from "./getEnvironmentContext";

export type CreateComponentContextContext = {
  config: Config;
  componentName: string;
  env: string;
  pipelineType?: PipelineType;
  trigger?: PipelineTrigger;
};

export const createComponentContext = async (
  ctx: CreateComponentContextContext,
): Promise<ComponentContext> => {
  if (!/^[a-z0-9-]+$/.test(ctx.componentName)) {
    throw new Error(
      "componentName may only contain lower case letters, numbers and -",
    );
  }

  const packageManagerInfo = await getPackageManagerInfoForComponent(
    ctx.config,
    ctx.componentName,
  );

  const envContext = getEnvironmentContext(ctx);

  const componentConfigWithoutDefaults = envContext.envConfigRaw;

  const resolvedBuildType = isStandaloneBuildConfig(
    componentConfigWithoutDefaults.build,
  )
    ? componentConfigWithoutDefaults.build.type
    : ctx.config.builds?.[componentConfigWithoutDefaults.build.from].type;
  if (!resolvedBuildType) {
    throw new Error("build type not found, is the build config correct?");
  }
  const defaults: {
    build: PartialDeep<BuildConfig>;
    deploy: PartialDeep<DeployConfig>;
  } = componentConfigWithoutDefaults.deploy
    ? {
        build: BUILD_TYPES[resolvedBuildType].defaults(envContext),
        deploy: DEPLOY_TYPES[
          componentConfigWithoutDefaults.deploy.type as DeployConfigType
        ].defaults(envContext as any),
      }
    : {
        build: BUILD_TYPES[resolvedBuildType].defaults(envContext),
        deploy: {},
      };

  const componentConfig = mergeWithMergingArrays(
    defaults,
    componentConfigWithoutDefaults,
  );

  const environment = await getEnvironment(ctx);
  const { deploy, build, customJobs, dir } = componentConfig;
  const getComponentDirs: BuildContext["getComponentDirs"] = (mode) => [
    dir,
    // also copy workspace dependencies in monorepo if packages are shared and they create build artifacts
    ...(mode === "all"
      ? packageManagerInfo.currentWorkspaceDependencies ?? []
      : []),
  ];
  const _getBuildContext = (): BuildContextComponent => {
    if (isStandaloneBuildConfig(build)) {
      return {
        dir: dir,
        getComponentDirs,
        config: build,
        buildType: build.type,
        type: "standalone",
      };
    }
    // must be shared build
    const referencedBuild = ctx.config.builds?.[build.from];
    if (!referencedBuild) {
      throw new Error("build.from not found in config");
    }
    return {
      dir: dir,
      getComponentDirs,
      config: build,
      workspaceBuildConfig: referencedBuild,
      workspaceName: build.from,
      buildType: referencedBuild.type,
      type: "fromWorkspace",
    };
  };
  const buildContext: BuildContextComponent = _getBuildContext();
  const context: Omit<ComponentContext, "customJobs"> = {
    type: "component",
    name: ctx.componentName,
    componentName: ctx.componentName,
    env: ctx.env,
    fullConfig: ctx.config,
    componentConfig,

    build: buildContext,
    deploy: deploy
      ? {
          config: deploy,
        }
      : null,

    environment,
    packageManagerInfo: packageManagerInfo,
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
