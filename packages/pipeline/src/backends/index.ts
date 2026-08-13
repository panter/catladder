import type {
  Config,
  PipelineOutputOptions,
  PipelineType,
  SecretsVaultConfig,
} from "../types";
import { GithubBackend } from "./github";
import { GitlabBackend } from "./gitlab";
import type { PipelineBackend } from "./types";

export * from "./types";
export * from "./gitlab";
export * from "./github";

const BACKENDS: { [T in PipelineType]: () => PipelineBackend } = {
  gitlab: () => new GitlabBackend(),
  github: () => new GithubBackend(),
};

/**
 * every pipeline type catladder knows how to generate — regardless of
 * what the config enables. Cleanup uses this to also reach backends that
 * were switched off (their files would otherwise linger).
 */
export const getAllPipelineTypes = (): PipelineType[] =>
  Object.keys(BACKENDS) as PipelineType[];

export const getPipelineBackend = (type: PipelineType): PipelineBackend => {
  const createBackend = BACKENDS[type];
  if (!createBackend) {
    throw new Error(`Pipeline type not supported: ${type}`);
  }
  return createBackend();
};

/**
 * the options of an enabled pipeline type (empty object when enabled
 * with `true`)
 */
export const getPipelineOptions = (
  config: Config,
  type: PipelineType,
): PipelineOutputOptions => {
  const value = config.pipelines?.[type];
  return typeof value === "object" ? value : {};
};

/**
 * the git remote pointing to the repository of this pipeline type's CI
 * system (e.g. during a migration, gitlab may be `origin` and github a
 * second remote)
 */
export const getPipelineGitRemote = (
  config: Config,
  type: PipelineType,
): string => getPipelineOptions(config, type).gitRemote ?? "origin";

/**
 * the normalized secrets vault of a config (string shorthands resolved
 * to their object form; defaults to the legacy gitlab store)
 */
export const getVaultConfig = (
  config: Config,
): Exclude<SecretsVaultConfig, string> => {
  const vault = config.secrets?.vault ?? "gitlab";
  return typeof vault === "string" ? { type: vault } : vault;
};

/**
 * the pipeline types enabled for this config. Multiple types can be
 * enabled at once (parallel generation, e.g. during a CI migration).
 */
export const getEnabledPipelineTypes = (config: Config): PipelineType[] => {
  if (config.pipelines) {
    const enabled = getAllPipelineTypes().filter(
      (type) => config.pipelines?.[type],
    );
    if (enabled.length === 0) {
      throw new Error(
        "`pipelines` is configured, but no pipeline type is enabled",
      );
    }
    return enabled;
  }
  return [config.pipelineType ?? "gitlab"];
};
