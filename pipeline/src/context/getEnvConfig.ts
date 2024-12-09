import { cloneDeep, mergeWith } from "lodash";
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
   * env config is merged with default. Arrays are not merged.
   * you can customize this by providing a function that takes the default value as argument
   */
  return mergeWith(
    // mergeWith unfortunatly mutates the first object, so we need to clone it.
    // Passing empty object also doesn't work for us, because that will mess with the customizer function (second argument isn't nessecary the customized value)
    cloneDeep(defaultConfig),
    envCustomizations,
    (defaultValue, customValue, key, obj, source) => {
      // check if custom value is a function (and default is not),
      // we currently don't have config options, that are functions, but we might in the future (customJobs is an exception)
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
