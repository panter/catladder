import type { UnspecifiedEnvVars } from "..";
import type { CatladderImageRef } from "../runner";
import type { CacheConfig } from "../build/types";
import { removeUndefined } from "../utils/removeUndefined";
import type {
  Artifacts,
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
  | { job: string; artifacts: boolean; workspaceName: string }
  // a job without component/workspace context (e.g. image build jobs);
  // optional needs tolerate the job being absent from the pipeline
  | { job: string; artifacts: boolean; optional?: boolean; global: true };

export const CAPABILITIES = [
  "build",
  "buildArtifacts",
  "dockerImage",
  "qualityGate",
  "deployment",
] as const;
/**
 * something a job provides to other jobs. Jobs declare what they require
 * via {@link Requirement}s and a planner resolves them to concrete job
 * dependencies over the whole pipeline.
 */
export type CapabilityName = (typeof CAPABILITIES)[number];

/**
 * a semantic dependency on a capability provided by other jobs
 */
export type Requirement = {
  /**
   * the capability the job requires
   */
  capability: CapabilityName;
  /**
   * whether the artifacts of the providing jobs are consumed
   */
  artifacts?: boolean;
  /**
   * where the capability must come from. Defaults to the job's own
   * component (or workspace for workspace jobs).
   */
  from?: { component?: string; workspace?: string };
  /**
   * whether pipeline generation fails when no job provides the
   * capability.
   *
   * Defaults to the value of `artifacts`: consuming artifacts from
   * nobody is almost always a broken configuration, while a plain
   * ordering requirement nobody provides simply creates no dependency
   * (e.g. quality gates don't run on tagged releases).
   */
  strict?: boolean;
};

/**
 * how a job interacts with a deployment environment.
 * Each pipeline type translates this to its own mechanism
 * (gitlab: the job `environment:` config incl. name and url).
 */
export type CatladderJobEnvironmentConfig = {
  /**
   * - start (default): the job creates/deploys the environment
   * - stop: the job tears the environment down
   * - access: the job uses the environment without changing it
   */
  action?: "start" | "stop" | "access";
  /**
   * name of the job (of the same component) that stops this environment
   */
  onStop?: string;
  /**
   * automatically stop the environment after this duration (e.g. "1 week")
   */
  autoStopIn?: string;
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
   * whether the job starts automatically ("auto") or requires a manual
   * action ("manual"). Each pipeline type translates this to its own
   * mechanism (gitlab: `when` + `allow_failure`).
   *
   * Prefer this over the gitlab-specific `when`/`allow_failure` fields.
   */
  gate?: "auto" | "manual";

  /**
   * script to run
   */
  script: (string | undefined)[];

  /**
   * semantic requirements on capabilities provided by other jobs.
   * A planner resolves them to concrete job dependencies (`needs`)
   * once all jobs of the pipeline are known.
   */
  requires?: Requirement[];

  /**
   * the capabilities this job provides to other jobs.
   * If not set, it is derived from the stage:
   * build -> "build", test -> "qualityGate", deploy -> "deployment"
   */
  provides?: CapabilityName[];

  /**
   * does this require another job (from the same component)?
   *
   * You can also require a job from another component if you set `componentName`
   *
   */
  needs?: Array<CatladderJobNeed>;

  /**
   * platform-neutral cache declarations. Each pipeline type resolves
   * them to its own cache mechanism (gitlab: the job `cache:` config).
   *
   * Prefer this over the gitlab-shaped `cache` field, which remains as
   * an escape hatch and takes precedence when set.
   */
  caches?: CacheConfig[];

  /**
   * declares that this job interacts with a deployment environment
   */
  environment?: CatladderJobEnvironmentConfig;

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
   * image to use: a concrete image or a reference to a
   * catladder-provided job image (resolved by the backend according to
   * the `jobImages` mode)
   */
  image?: GitlabJobImage | CatladderImageRef;

  /**
   * whether failures are allowed
   */
  allow_failure?: boolean;

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
