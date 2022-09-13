import type {
  Config,
  EnvType,
  PipelineTrigger} from "../types";
import {
  DEFAULT_ENV_TYPES,
  getEnvTypesByTrigger
} from "../types";

const getConfiguredAndDefaultEnvs = (
  config: Config,
  componentName: string,
  envTypes: EnvType[]
) => {
  const configuredEnvs = config.components[componentName].env ?? {};
  // the default envs have the same name as the env types
  // these can be disabled with settimg them to `false`
  // this is the list of all not disabled envs. These are always returned
  const enabledDefaultEnvs = envTypes.filter(
    (e) => configuredEnvs[e] !== false
  );

  const configuredCustomEnvs = Object.entries(
    config.components[componentName].env ?? {}
  )
    .filter(
      ([, config]) =>
        config &&
        "type" in config &&
        config.type &&
        envTypes.includes(config.type)
    )
    .map(([envName]) => envName);

  return [...new Set([...enabledDefaultEnvs, ...configuredCustomEnvs])];
};

export const getAllEnvs = (config: Config, componentName: string) => {
  return getConfiguredAndDefaultEnvs(config, componentName, DEFAULT_ENV_TYPES);
};

export const getAllEnvsInAllComponents = (config: Config) => {
  return [
    ...new Set(
      Object.keys(config.components).flatMap((c) => getAllEnvs(config, c))
    ),
  ];
};

export const getAllEnvsByTrigger = (
  config: Config,
  componentName: string,
  trigger: PipelineTrigger
) => {
  const envTypesByTrigger = getEnvTypesByTrigger(trigger);
  return getConfiguredAndDefaultEnvs(config, componentName, envTypesByTrigger);
};
