import type { GitlabJobDef, GitlabPipeline } from "./gitlab-types";

export type PipelineType = "gitlab";

export type PipelineMode<T extends PipelineType> = T extends "gitlab"
  ? "childpipeline" | "local"
  : "local";

export type PipelineJob<T extends PipelineType> = T extends "gitlab"
  ? GitlabJobDef
  : never;

export type Pipeline<T extends PipelineType> = T extends "gitlab"
  ? GitlabPipeline
  : never;
