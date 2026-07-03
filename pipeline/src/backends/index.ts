import type { PipelineType } from "../types";
import { GitlabBackend } from "./gitlab";
import type { PipelineBackend } from "./types";

export * from "./types";
export * from "./gitlab";

const BACKENDS: { [T in PipelineType]: () => PipelineBackend } = {
  gitlab: () => new GitlabBackend(),
};

export const getPipelineBackend = (type: PipelineType): PipelineBackend => {
  const createBackend = BACKENDS[type];
  if (!createBackend) {
    throw new Error(`Pipeline type not supported: ${type}`);
  }
  return createBackend();
};
