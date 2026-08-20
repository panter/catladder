import type { EnvironmentConfig, EnvType } from "../types";
import { isKnowEnvType } from "../types";

export const getEnvType = (
  env: string,
  envConfig: {
    type?: EnvType;
  },
  environments?: Record<string, EnvironmentConfig>,
): EnvType => {
  // legacy: per-component custom envs declare their type themselves
  if (envConfig.type) return envConfig.type;

  // project-wide declaration (top-level `environments`)
  const declaredType = environments?.[env]?.type;
  if (declaredType) return declaredType;

  if (isKnowEnvType(env)) {
    return env;
  }

  throw new Error("unknown env type: " + env);
};
