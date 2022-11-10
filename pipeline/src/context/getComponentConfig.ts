import type { BuildConfig } from "../build";
import { BUILD_TYPES } from "../build";
import type { DeployConfig } from "../deploy";
import { DEPLOY_TYPES } from "../deploy";
import type { Config } from "../types/config";
import { mergeWithMergingArrays } from "../utils";

export const getComponentConfig = (
  config: Config,
  componentName: string,
  env: string
) => {
  const defaultConfig = config.components[componentName];
  if (!defaultConfig) {
    throw new Error("unknown component " + componentName);
  }

  const envCustomizations = defaultConfig.env?.[env] ?? {};
  if (envCustomizations === false) {
    throw new Error("env is disabled: " + env);
  }

  const componentConfigWithoutDefaults = mergeWithMergingArrays(
    defaultConfig,
    envCustomizations
  );

  // fill in defaults from build and deploy
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
  return mergeWithMergingArrays(defaults, componentConfigWithoutDefaults);
};
