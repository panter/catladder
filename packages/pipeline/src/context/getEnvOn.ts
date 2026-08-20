import type { EnvironmentConfig, EnvOnConfig, EnvType } from "../types";
import { ENV_TYPES } from "../types";
import { getEnvType } from "./getEnvType";

const getDefaultOnForType = (envType: EnvType): EnvOnConfig => {
  const triggers = ENV_TYPES[envType].triggers as readonly EnvOnConfig[];
  return triggers[0] ?? false;
};

/**
 * resolves when an env deploys: the project-wide `on` config of the env
 * (top-level `environments`), falling back to the default of its env
 * type (dev → mainBranch, review → mr, stage/prod → taggedRelease,
 * local → false).
 *
 * `on` is deliberately not configurable per component — an environment
 * deploys at one point in time for the whole project.
 */
export const getEnvOn = (
  env: string,
  envConfig: {
    type?: EnvType;
  },
  environments?: Record<string, EnvironmentConfig>,
): EnvOnConfig => {
  const on = environments?.[env]?.on;
  if (on !== undefined) return on;
  return getDefaultOnForType(getEnvType(env, envConfig, environments));
};
