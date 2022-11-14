import { BUILD_TYPES } from "../build";
import type { BuildConfig, BuildConfigType } from "../build/types";
import { DEPLOY_TYPES } from "../deploy";
import type { DeployConfig, DeployConfigType } from "../deploy/types";
import type { Config } from "../types/config";
import type { CommitInfo, Context, PackageManagerInfo } from "../types/context";
import { mergeWithMergingArrays } from "../utils";
import { getEnvironment } from "./getEnvironment";
import { getEnvironmentContext } from "./getEnvironmentContext";

export * from "./getEnvironment";
export * from "./getEnvironmentVariables";

export const createContext = async (
  config: Config,
  componentName: string,
  env: string,
  commitInfo?: CommitInfo,
  packageManagerInfo?: PackageManagerInfo
): Promise<Context> => {
  if (!/^[a-z0-9-]+$/.test(componentName)) {
    throw new Error(
      "componentName may only contain lower case letters, numbers and -"
    );
  }

  const envContext = getEnvironmentContext(
    config,
    env,
    componentName,
    commitInfo
  );

  const componentConfigWithoutDefaults = envContext.envConfigRaw;
  const defaults: {
    build: Partial<BuildConfig>;
    deploy: Partial<DeployConfig>;
  } = componentConfigWithoutDefaults.deploy
    ? {
        build:
          BUILD_TYPES[
            componentConfigWithoutDefaults.build.type as BuildConfigType
          ].defaults(envContext),
        deploy:
          DEPLOY_TYPES[
            componentConfigWithoutDefaults.deploy.type as DeployConfigType
          ].defaults(envContext),
      }
    : {
        build: {},
        deploy: {},
      };
  const componentConfig = mergeWithMergingArrays(
    defaults,
    componentConfigWithoutDefaults
  );

  return {
    fullConfig: config,
    componentConfig,
    componentName,
    environment: await getEnvironment(config, componentName, env, commitInfo),
    commitInfo,
    packageManagerInfo,
  };
};
