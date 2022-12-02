export type Artifacts = {
  paths: string[];
};
export type GitlabJobCache = {
  key: string;
  policy?: string;
  paths: string[];
};
export type GitlabRule = {
  if?: string;
  when?: "always" | "on_success" | "manual" | "never"; // todo
  allow_failure?: boolean;
};
export type Retry = {
  max: number;
  when: string[];
};

export type GitlabJobService = {
  name: string;
  command?: string[];
  entrypoint?: string[];
  alias?: string;
};

export type GitlabEnvironment = {
  url: string;
  name: string;
  kubernetes?: {
    namespace?: string;
  };
  action?: "stop" | "start" | "prepare" | "access"; // defaults to start
  on_stop?: string; // other job to run on stop
  auto_stop_in?: string;
};
export type GitlabJobDef = {
  stage: string;
  before_script?: string[];
  script: (string | undefined)[];
  interruptible?: boolean;
  needs?: Array<string | { job: string; artifacts: boolean }>;
  rules?: GitlabRule[];
  cache?: GitlabJobCache | GitlabJobCache[];
  artifacts?: Artifacts;
  retry?: Retry;
  services?: GitlabJobService[];
  image?: string;
  variables?: GitlabVariables;
  dependencies?: string[];
  environment?: GitlabEnvironment;
  allow_failure?: boolean;
  trigger?: {
    strategy: "depend";
    include: Array<{
      artifact: string;
      job: string;
    }>;
  };
};

export type GitlabVariables = Record<string, string | undefined>;

/**
 * this is not precicily the type of a gitlab-pipeline
 * the jobs nee to be merge into the object.
 * Problem is, that this type cannot be represented properly with typescript, see https://github.com/microsoft/TypeScript/issues/17867
 */
export type GitlabPipeline = {
  image: string;
  variables: GitlabVariables;
  workflow?: {
    rules: GitlabRule[];
  };
  stages: string[];
  jobs: Record<string, GitlabJobDef>;
};
