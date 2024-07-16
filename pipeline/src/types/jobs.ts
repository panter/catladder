import type { UnspecifiedEnvVars } from "..";
import type {
  Artifacts,
  GitlabEnvironment,
  GitlabJobCache,
  GitlabJobDef,
  GitlabJobImage,
  GitlabRule,
} from "./gitlab-types";

export type CatladderJobCache = GitlabJobCache;
export const BASE_STAGES = [
  "setup",
  "test",
  "build",
  "deploy",
  "verify",
  "rollback",
  "stop",
] as const;
export type BaseStage = (typeof BASE_STAGES)[number];

export type CatladderJobNeed =
  | string
  | { job: string; artifacts: boolean; componentName?: string }
  | { job: string; artifacts: boolean; workspaceName: string };

export type CatladderJobEnvironmentConfig = {
  action?: GitlabEnvironment["action"];
  on_stop?: GitlabEnvironment["on_stop"];
  auto_stop_in?: string;
};
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
    workspaceName?: string;
  }[];

  /**
   * does this require another job (from the same component)?
   *
   * You can also require a job from another component if you set `componentName`
   *
   */
  needs?: Array<CatladderJobNeed>;

  /**
   * cache config, we use here the same shape as gitlab itself
   */
  cache?: CatladderJobCache | CatladderJobCache[];

  /**
   * job artifacts, we also use gitlab shape here
   */
  artifacts?: Artifacts;

  /**
   * additional services, mainly used for docker
   */
  services?: GitlabJobDef["services"];

  /**
   * image to use
   */
  image?: GitlabJobImage;

  /**
   * variables to pass
   */
  variables: UnspecifiedEnvVars | undefined;

  /**
   * additional vars only for the runner.
   * Also if you use services: that require env vars, you need to set them here.
   *
   */
  runnerVariables?: Record<string, string>;

  /**
   * whether failures are allowed
   */
  allow_failure?: boolean;

  /**
   * gitlab environment config, subject to change
   */
  environment?: CatladderJobEnvironmentConfig;

  /** */

  when?: GitlabRule["when"];

  rules?: GitlabRule[];

  /**
   * How many instances of a job should be run in parallel.
   * Useful for big test suites that can be split into multiple pipeline jobs.
   * We use the same shape as GitLab itself.
   */
  parallel?: number;

  /**
   * tags for the underlying job runner (e.g gitlab)
   */
  jobTags?: string[];
};
