import { cloneDeep, mergeWith, omit } from "lodash-es";
import type { Config, EnvConfigWithComponent } from "../types/config";
import { getInheritedConfigChain } from "./getEnvInherit";

export const getEnvConfig = (
  config: Config,
  componentName: string,
  env: string,
): EnvConfigWithComponent => {
  const defaultConfig = config.components[componentName];
  if (!defaultConfig) {
    throw new Error("unknown component " + componentName);
  }

  // env config is layered onto the component config: the per-component
  // overrides of inherited envs first (oldest ancestor first, see
  // `environments.<name>.inherit`), the env's own overrides last
  const chain = [...getInheritedConfigChain(config.environments, env), env];

  // mergeWith unfortunatly mutates the first object, so we need to clone it.
  // Passing empty object also doesn't work for us, because that will mess with the customizer function (second argument isn't nessecary the customized value)
  const result = cloneDeep(defaultConfig);

  for (const chainEnv of chain) {
    const envCustomizations = defaultConfig.env?.[chainEnv];
    if (!envCustomizations || envCustomizations === false) {
      if (chainEnv === env && envCustomizations === false) {
        // env is disabled, still return the default config
        return defaultConfig;
      }
      continue;
    }
    /**
     * env config is merged with default. Arrays are not merged.
     * you can customize this by providing a function that takes the default value as argument
     */
    mergeWith(
      result,
      // `host` must stay unique per env and `type` is the inherited
      // env's identity — neither is inherited
      chainEnv === env
        ? envCustomizations
        : omit(envCustomizations, ["host", "type"]),
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
  }

  return result;
};
