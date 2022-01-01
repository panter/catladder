export type GitlabStage =
  | "setup"
  | "test"
  | "build"
  | "deploy"
  | "verify"
  | "actions";

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

export type Service = {
  name: string;
  command: string[];
};

export type GitlabEnvironment = {
  url: string;
  name: string;
  kubernetes?: {
    namespace?: string;
  };
  action?: "stop" | "start" | "prepare"; // defaults to start
  on_stop?: string; // other job to run on stop
  auto_stop_in?: string;
};
export type GitlabJobDef = {
  stage: GitlabStage;
  before_script?: string[];
  script: (string | undefined)[];
  interruptible?: boolean;
  needs?: string[];
  rules?: GitlabRule[];
  cache?: GitlabJobCache | GitlabJobCache[];
  artifacts?: Artifacts;
  retry?: Retry;
  services?: Service[];
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

export type GitlabJob = {
  name: string;
  perEnv?: boolean;
  job: GitlabJobDef;
};
export type GitlabJobs = GitlabJob[];

export type GitlabPipeline = {
  variables: GitlabVariables;
  stages: GitlabStage[];
  jobs: GitlabJobs;
};
