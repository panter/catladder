import type { EnvironmentConfig, EnvType } from "../types";
import { isKnowEnvType } from "../types";
import { normalizeEnvInherit } from "./getEnvInherit";

/**
 * the type of a project-wide declared env: its explicit `type`, its
 * name (when it is itself an env type), or — for envs that inherit —
 * the type of the env they inherit their config from
 */
export const getDeclaredEnvType = (
  environments: Record<string, EnvironmentConfig> | undefined,
  env: string,
  seen: Set<string> = new Set(),
): EnvType | undefined => {
  const declared = environments?.[env];
  if (declared?.type) return declared.type;
  if (isKnowEnvType(env)) return env;

  const inheritTarget = normalizeEnvInherit(declared?.inherit).config;
  if (inheritTarget && !seen.has(inheritTarget)) {
    seen.add(inheritTarget);
    return getDeclaredEnvType(environments, inheritTarget, seen);
  }
  return undefined;
};

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
  const declaredType = getDeclaredEnvType(environments, env);
  if (declaredType) return declaredType;

  throw new Error("unknown env type: " + env);
};
