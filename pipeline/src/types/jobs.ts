import type { UnspecifiedEnvVars } from "..";
import { removeUndefined } from "../utils/removeUndefined";
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
  "agents",
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

/**
 * the platform-agnostic properties of a job
 */
export type CatladderJobCore<S = BaseStage> = {
  /**
   * the name of the job (without any env or app prefix and suffix)
   */
  name: string;
  /**
   * envMode sets the behavior of the job regarding multiple envs:
   * - jobPerEnv: the job runs once per env (default)
   * - stagePerEnv: the job runs once per env and is organized in its own stage. This mproves usability in gitlab, but works the same as `jobPerEnv`
   */
  envMode?: "jobPerEnv" | "stagePerEnv";

  /**
   * the stage of the job
   */
  stage: S;

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
   * variables to pass
   */
  variables: UnspecifiedEnvVars | undefined;

  /**
   * additional vars only for the runner.
   * Also if you use services: that require env vars, you need to set them here.
   *
   */
  runnerVariables?: Record<string, string>;
};

/**
 * job properties that (still) use GitLab CI shapes or semantics directly.
 *
 * Long-term these should either be generalized into {@link CatladderJobCore}
 * or be resolved by a pipeline-type specific renderer.
 */
export type GitlabJobFields = {
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

  /**
   * whether the job is interruptible (default: true)
   */
  interruptible?: boolean;
};

/**
 * the plain-data shape of a job. This is what job creators resolve
 * and what users can provide for e.g. `customJobs`.
 */
export type CatladderJobSpec<S = BaseStage> = CatladderJobCore<S> &
  GitlabJobFields;

// declaration merging: the class carries the spec properties without
// re-declaring them; they are assigned in the constructor.

export interface CatladderJob<S = BaseStage>
  extends CatladderJobCore<S>,
    GitlabJobFields {}

/**
 * a pipeline job. Subclasses encapsulate how a specific kind of job
 * (build, deploy, ...) is resolved from its context and definition.
 *
 * Instances are plain-data compatible with {@link CatladderJobSpec}:
 * only the spec's own (defined) properties are assigned, so spreading /
 * destructuring an instance behaves exactly like the spec object.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging -- the merged interface declares exactly the properties the constructor assigns
export class CatladderJob<S = BaseStage> {
  constructor(spec: CatladderJobSpec<S>) {
    // skip undefined values so that defaults applied later
    // (e.g. when converting to a gitlab job) are not clobbered
    Object.assign(this, removeUndefined(spec));
  }

  static from<Stage>(
    job: CatladderJobSpec<Stage> | CatladderJob<Stage>,
  ): CatladderJob<Stage> {
    return job instanceof CatladderJob ? job : new CatladderJob(job);
  }
}
