import type { Config, EnvConfigWithComponent } from "../types/config";

import { mergeWithMergingArrays } from "../utils";

export const getEnvConfig = (
  config: Config,
  componentName: string,
  env: string,
): EnvConfigWithComponent => {
  const defaultConfig = config.components[componentName];
  if (!defaultConfig) {
    throw new Error("unknown component " + componentName);
  }

  const envCustomizations = defaultConfig.env?.[env] ?? {};
  if (envCustomizations === false) {
    throw new Error("env is disabled: " + env + ":" + componentName);
  }

  return mergeWithMergingArrays(defaultConfig, envCustomizations);
};
