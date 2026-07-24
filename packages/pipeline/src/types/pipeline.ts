import type { GithubJob, GithubWorkflow } from "./github-types";
import type { GitlabJobDef, GitlabPipeline } from "./gitlab-types";

export type PipelineType = "gitlab" | "github";

export type PipelineJob<T extends PipelineType> = T extends "gitlab"
  ? GitlabJobDef
  : T extends "github"
    ? GithubJob
    : never;

export type Pipeline<T extends PipelineType> = T extends "gitlab"
  ? GitlabPipeline
  : T extends "github"
    ? Record<string, GithubWorkflow>
    : never;
