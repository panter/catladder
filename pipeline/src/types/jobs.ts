import {
  Artifacts,
  GitlabEnvironment,
  GitlabJobCache,
  GitlabRule,
  GitlabVariables,
  Service,
} from "./gitlab-types";

export const BASE_STAGES = [
  "setup",
  "test",
  "build",
  "deploy",
  "verify",
  "stop",
] as const;
export type BaseStage = typeof BASE_STAGES[number];

export type CatladderJob<S = BaseStage> = {
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

  /**
   * the stage of the job
   */
  stage: S;
  /**
   * does this require another stage?
   */

  /**
   * script to run
   */
  script: (string | undefined)[];

  needsStages?: {
    stage: S;
    artifacts?: boolean;
  }[];

  /**
   * does this require another job?
   */
  needs?: Array<string | { job: string; artifacts: boolean }>;
  /**
   * cache config, we use here the same shape as gitlab itself
   */
  cache?: GitlabJobCache | GitlabJobCache[];

  /**
   * job artifacts, we also use gitlab shape here
   */
  artifacts?: Artifacts;

  /**
   * additional services, mainly used for docker
   */
  services?: Service[];

  /**
   * image to use
   */
  image?: string;

  /**
   * variables to pass
   */
  variables: GitlabVariables;

  /**
   * whether failures are allowed
   */
  allow_failure?: boolean;

  environment?: GitlabEnvironment;

  rules?: GitlabRule[];
};
