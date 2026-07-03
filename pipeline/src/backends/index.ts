import type { Config, PipelineType } from "../types";
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

export const getPipelineBackend = (type: PipelineType): PipelineBackend => {
  const createBackend = BACKENDS[type];
  if (!createBackend) {
    throw new Error(`Pipeline type not supported: ${type}`);
  }
  return createBackend();
};

/**
 * the pipeline types enabled for this config. Multiple types can be
 * enabled at once (parallel generation, e.g. during a CI migration).
 */
export const getEnabledPipelineTypes = (config: Config): PipelineType[] => {
  if (config.pipelines) {
    const enabled = (Object.keys(BACKENDS) as PipelineType[]).filter(
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
