import type { EnvironmentConfig } from "../types/config";
import { isKnowEnvType } from "../types/config";

type Environments = Record<string, EnvironmentConfig> | undefined;

export type NormalizedEnvInherit = {
  config?: string;
  secrets?: string;
};

export const normalizeEnvInherit = (
  inherit: EnvironmentConfig["inherit"],
): NormalizedEnvInherit => {
  if (!inherit) return {};
  if (typeof inherit === "string") {
    return { config: inherit, secrets: inherit };
  }
  return {
    config: inherit.config,
    secrets: inherit.secrets === false ? undefined : inherit.secrets,
  };
};

const assertValidInheritTarget = (
  environments: Environments,
  env: string,
  target: string,
) => {
  if (target === "local") {
    throw new Error(
      `environment "${env}" cannot inherit from "local" — local is not a deployment environment`,
    );
  }
  if (!isKnowEnvType(target) && !environments?.[target]) {
    throw new Error(
      `environment "${env}" inherits from unknown environment "${target}"`,
    );
  }
};

/**
 * the chain of envs whose per-component config overrides feed into
 * `env`, oldest ancestor first (env itself not included). Cycles and
 * unknown/`local` targets are an error.
 */
export const getInheritedConfigChain = (
  environments: Environments,
  env: string,
): string[] => {
  const chain: string[] = [];
  const seen = new Set([env]);
  let current = env;
  for (;;) {
    const target = normalizeEnvInherit(environments?.[current]?.inherit).config;
    if (!target) break;
    assertValidInheritTarget(environments, current, target);
    if (seen.has(target)) {
      throw new Error(
        `environment "${env}" has a cyclic config inheritance via "${target}"`,
      );
    }
    seen.add(target);
    chain.unshift(target);
    current = target;
  }
  return chain;
};

/**
 * the env whose secret values `env` uses (follows `inherit` secret
 * sharing transitively; the env itself when it has its own secrets).
 * All secret variable names must be built with this env.
 */
export const getSecretsEnv = (
  environments: Environments,
  env: string,
): string => {
  const seen = new Set([env]);
  let current = env;
  for (;;) {
    const target = normalizeEnvInherit(
      environments?.[current]?.inherit,
    ).secrets;
    if (!target) return current;
    assertValidInheritTarget(environments, current, target);
    if (seen.has(target)) {
      throw new Error(
        `environment "${env}" has a cyclic secrets inheritance via "${target}"`,
      );
    }
    seen.add(target);
    current = target;
  }
};
