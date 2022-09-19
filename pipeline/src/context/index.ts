import { BUILD_TYPES } from "../build";
import type { BuildConfig } from "../build/types";
import { DEPLOY_TYPES } from "../deploy";
import type { DeployConfig } from "../deploy/types";
import type { Config } from "../types/config";
import type { CommitInfo, Context, PackageManagerInfo } from "../types/context";
import { mergeWithMergingArrays } from "../utils";
import { getEnvironment } from "./getEnvironment";

export * from "./getEnvironment";

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
  const rawConfig = config.components[componentName];
  if (!rawConfig) {
    throw new Error("unknown component " + componentName);
  }
  // envs can override the config
  const envConfig = rawConfig.env?.[env] ?? {};
  const componentConfigWithoutDefaults = mergeWithMergingArrays(
    rawConfig,
    envConfig
  );

  // fill in defaults of build and deploy
  const defaults: {
    build: Partial<BuildConfig>;
    deploy: Partial<DeployConfig>;
  } = componentConfigWithoutDefaults.deploy
    ? {
        build:
          BUILD_TYPES[componentConfigWithoutDefaults.build.type].defaults(),
        deploy:
          DEPLOY_TYPES[componentConfigWithoutDefaults.deploy.type].defaults(),
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
