import type {
  Artifacts as GitlabCiArtifacts,
  JobTemplate,
  Cache,
  Rules,
} from "./gitlab-ci-yml";

export { Retry, Image as GitlabJobImage } from "./gitlab-ci-yml";

// Reports won't show up on MRs until https://gitlab.com/groups/gitlab-org/-/epics/8205
export interface Artifacts extends Omit<GitlabCiArtifacts, "paths"> {
  paths: string[];
}
export type GitlabJobCache = Cache;
export type GitlabRule = Exclude<Rules, null>[number];
export type GitlabEnvironment = Omit<
  Exclude<JobTemplate["environment"], undefined | string>,
  "deployment_tier"
>;

export interface GitlabJobDef
  extends Pick<
    JobTemplate,
    | "after_script"
    | "allow_failure"
    | "artifacts"
    | "before_script"
    | "coverage"
    | "dependencies"
    | "environment"
    | "except"
    | "hooks"
    | "image"
    | "interruptible"
    | "needs"
    | "only"
    | "parallel"
    | "release"
    | "resource_group"
    | "retry"
    | "rules"
    | "script"
    | "services"
    | "stage"
    | "tags"
    | "trigger"
    | "variables"
  > {
  stage: JobTemplate["stage"];
  rules?: GitlabRule[];
  cache?: GitlabJobCache | GitlabJobCache[];
  artifacts?: Artifacts;
  tags?: string[];
}

/**
 * this is not precicily the type of a gitlab-pipeline
 * the jobs nee to be merge into the object.
 * Problem is, that this type cannot be represented properly with typescript, see https://github.com/microsoft/TypeScript/issues/17867
 */
export interface GitlabPipeline extends Pick<JobTemplate, "variables"> {
  image: string;
  workflow?: {
    rules: GitlabRule[];
  };
  stages: string[];
  jobs: Record<string, GitlabJobDef>;
}
