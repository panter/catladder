import { mergeWith } from "lodash";
import type { Config, EnvConfigWithComponent } from "../types/config";

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
    // env is disabled, still return the default config
    return defaultConfig;
  }
  /**
   *   env config is merged with default. Arrays are not merged.
   * you can customize this by providing a function that takes the default value as argument
   */
  return mergeWith(
    {},
    defaultConfig,
    envCustomizations,
    (defaultValue, customValue) => {
      // check if custom value is a function (and default is not),
      // we currently don't have config options that are functions, but we might in the future
      if (
        typeof customValue === "function" &&
        typeof defaultValue !== "function"
      ) {
        return customValue(defaultValue);
      }

      return undefined;
    },
  );
};
