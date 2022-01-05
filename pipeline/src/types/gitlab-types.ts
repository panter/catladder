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
  stage: string;
  before_script?: string[];
  script: (string | undefined)[];
  interruptible?: boolean;
  needs?: Array<string | { job: string; artifacts: boolean }>;
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

export const GITLAB_BASE_STAGES = [
  "setup",
  "test",
  "build",
  "deploy",
  "verify",
  "stop",
] as const;
export type GitlabBaseStage = typeof GITLAB_BASE_STAGES[number];
export type GitlabVariables = Record<string, string | undefined>;

export type GitlabJob = {
  /**
   * the name of the job (without any env or app prefix and suffix)
   */
  name: string;
  /**
   * envMode sets the behavior of the job regarding multiple envs:
   * - none: the job does not run per env, but once for all envs
   * - jobPerEnv: the job runs once per env
   * - stagePerEnv: the job runs once per env and is organized in its own stage. This mproves usability in gitlab, but works the same as `jobPerEnv`
   */
  envMode: "jobPerEnv" | "stagePerEnv" | "none";
  job: GitlabJobDef;
  needsStages?: {
    stage: GitlabBaseStage;
    artifacts?: boolean;
  }[];
};
export type GitlabJobs = GitlabJob[];

export type GitlabPipeline = {
  variables: GitlabVariables;
  stages: string[];
  jobs: GitlabJobs;
};
