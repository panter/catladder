import type {
  BranchPipelineTrigger,
  Config,
  EnvPipelineTrigger,
  EnvType,
} from "../types";
import {
  DEFAULT_ENV_TYPES,
  envTriggerEquals,
  isBranchTrigger,
  isKnowEnvType,
} from "../types";
import { getEnvOn } from "../context/getEnvOn";

const getConfiguredAndDefaultEnvs = (
  config: Config,
  componentName: string,
  envTypes: EnvType[],
) => {
  const configuredEnvs = config.components[componentName].env ?? {};
  // the default envs have the same name as the env types
  // these can be disabled with settimg them to `false`
  // this is the list of all not disabled envs. These are always returned
  const enabledDefaultEnvs = envTypes.filter(
    (e) => configuredEnvs[e] !== false,
  );

  // envs declared project-wide (top-level `environments`): every
  // component deploys to them unless it opts out with `env.<name>: false`
  const declaredEnvs = Object.entries(config.environments ?? {})
    .filter(([envName]) => !isKnowEnvType(envName)) // default envs are already handled above
    .map(([envName, envConfig]) => {
      if (!envConfig.type) {
        throw new Error(
          `environment "${envName}" needs a type (dev, review, stage, prod)`,
        );
      }
      return [envName, envConfig.type] as const;
    })
    .filter(
      ([envName, envType]) =>
        envTypes.includes(envType) && configuredEnvs[envName] !== false,
    )
    .map(([envName]) => envName);

  // legacy: custom envs declared per component via their `type`
  const configuredCustomEnvs = Object.entries(configuredEnvs)
    .filter(
      ([, config]) =>
        config &&
        "type" in config &&
        config.type &&
        envTypes.includes(config.type),
    )
    .map(([envName]) => envName);

  return [
    ...new Set([
      ...enabledDefaultEnvs,
      ...declaredEnvs,
      ...configuredCustomEnvs,
    ]),
  ];
};

export const getAllEnvs = (config: Config, componentName: string) => {
  return getConfiguredAndDefaultEnvs(config, componentName, DEFAULT_ENV_TYPES);
};

export const getAllEnvsInAllComponents = (config: Config) => {
  return [
    ...new Set(
      Object.keys(config.components).flatMap((c) => getAllEnvs(config, c)),
    ),
  ];
};

/**
 * the resolved `on` of one env of a component (the project-wide `on`
 * of the env, falling back to the env type's default trigger)
 */
const getEnvOnForComponentEnv = (
  config: Config,
  componentName: string,
  env: string,
) => {
  const entry = config.components[componentName].env?.[env];
  return getEnvOn(
    env,
    entry && entry !== false ? entry : {},
    config.environments,
  );
};

export const getAllEnvsByTrigger = (
  config: Config,
  componentName: string,
  trigger: EnvPipelineTrigger,
) => {
  return getAllEnvs(config, componentName).filter((env) =>
    envTriggerEquals(
      getEnvOnForComponentEnv(config, componentName, env),
      trigger,
    ),
  );
};

/**
 * all branch triggers declared by any env of any component (via
 * `on: { branch: "..." }`), deduplicated and sorted for deterministic
 * pipeline generation. Each gets its own pipeline next to the built-in
 * triggers.
 */
export const getConfiguredBranchTriggers = (
  config: Config,
): BranchPipelineTrigger[] => {
  const branches = new Set<string>();
  for (const componentName of Object.keys(config.components)) {
    for (const env of getAllEnvs(config, componentName)) {
      const on = getEnvOnForComponentEnv(config, componentName, env);
      if (on && isBranchTrigger(on)) {
        branches.add(on.branch);
      }
    }
  }
  return [...branches].sort().map((branch) => ({ branch }));
};
