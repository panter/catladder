import type { BuildConfig } from "../build/types";
import type { DeployConfig } from "../deploy/types";

import type { CatladderJob } from "./jobs";
import type { ComponentContext } from "./context";
import type { PartialDeep } from "./utils";
import type { PipelineType, WorkspaceBuildConfig } from "..";
import type { AgentConfig } from "./agent";

export const ALL_PIPELINE_TRIGGERS = [
  "mainBranch",
  "mr",
  "taggedRelease",
] as const;
export type PipelineTrigger = (typeof ALL_PIPELINE_TRIGGERS)[number];

/**
 * all env types with their trigger.
 * Each env type has a default env with the same name which is always included
 */
export const ENV_TYPES = {
  dev: {
    triggers: ["mainBranch"],
  },
  review: {
    triggers: ["mr"],
  },
  stage: {
    triggers: ["taggedRelease"],
  },
  prod: {
    triggers: ["taggedRelease"],
  },
  local: {
    triggers: [],
  },
} as const;

/**
 *
 * @param trigger a trigger
 * @returns array of env types for that trigger. this is also the list of default envs
 */
export const getEnvTypesByTrigger = (trigger: PipelineTrigger) =>
  Object.entries(ENV_TYPES)
    .filter(([, e]) =>
      (e.triggers as readonly PipelineTrigger[]).includes(trigger),
    )
    .map(([e]) => e as EnvType);

export const DEFAULT_ENVS = Object.keys(ENV_TYPES);
export const DEFAULT_ENV_TYPES = DEFAULT_ENVS as EnvType[];
export type EnvType = keyof typeof ENV_TYPES;

export const isKnowEnvType = (env: string): env is EnvType => {
  return env in ENV_TYPES;
};

export type EnvVars = {
  /**
   * public env vars (means: they are checked in the repo).
   *
   * You can reuse env vars in other vars using ${OTHER_VAR}.
   * You an reuse other public env vars, or secret env vars
   *
   * EXAMPLE: A_VAR: "the other var is ${OTHER_VAR}"
   *
   * You can reuse vars from other components in the same project using ${componentName:variableName}
   * EXAMPLE: A_VAR: "the other var is ${api:OTHER_VAR}"
   */

  public?: Record<string, any>;
  /**
   * secret env vars. These vars can be managed with catladder/cli
   */
  secret?: string[];
};

export type DefaultEnvConfig = {
  /**
   * how the app is deployed
   */
  deploy: DeployConfig | false;
  /**
   * how the app is built and its runtime
   */
  build: BuildConfig | false;
  /**
   * environment variables
   */
  vars?: EnvVars;
};

export type DevLocalEnvConfig = {
  vars?: EnvVars;
  port?: number;
};
type AddOverrideFunction<T> = {
  [K in keyof T]:
    | T[K] // either accept the value
    | ((defaultValue: T[K]) => T[K]) // or function that returns the value
    | (T[K] extends Record<string, unknown> | undefined // unknown is important, see https://stackoverflow.com/questions/71422178/typescript-record-accepts-array-why
        ? AddOverrideFunction<T[K]>
        : never); // or a nested object
};

type EnvConfigWithOverride<E extends EnvType = EnvType> = AddOverrideFunction<
  EnvConfig<E>
>;
export type EnvConfig<E extends EnvType = EnvType> = {
  /**
   * type of the env (stage, prod, review, dev)
   */
  type?: E;
  /**
   * host that is used. If not set, a "canonical" url is created
   */
  host?: string;
} & PartialDeep<DefaultEnvConfig>;

export type EnvConfigWithComponent = EnvConfig<EnvType> & ComponentConfig;

export type CustomEnv = EnvConfigWithOverride & {
  type: EnvType;
};
export type Env<C extends ConfigProps = never> = {
  /**
   * local is a special env that is only used in local development
   */
  local?: AddOverrideFunction<DevLocalEnvConfig>;

  dev?: EnvConfigWithOverride<"dev"> | false;
  stage?: EnvConfigWithOverride<"stage"> | false;
  review?: EnvConfigWithOverride<"review"> | false;
  prod?: EnvConfigWithOverride<"prod"> | false;
  // unfortunatly, typescript does not properly support objects with a mix of known and unknown properties.
  // for backwards compatiblity we allow unknown props, but we cannot type it (typescript problem)
  // however, we now support providing custom envs through a generic parameter of `Config`
} & Record<C["CustomEnvs"], CustomEnv> &
  Record<string, any>;
export type ComponentConfig<C extends ConfigProps = never> = {
  /**
   * specify environment configurations
   */
  env?: Env<C>;
  /**
   * the directory of the component (e.g. where the package.json or similar is located). You can set "." if you only have one app.
   */
  dir: string;

  /**
   * add custom jobs. Can be an array or a function that receives the context and returns an array of jobs.
   * For convenience, all env vars are injectd as variables
   *
   * Please raise an issue on https://git.panter.ch/catladder/catladder
   * to let us know about why you need to use custom jobs.
   * This feedback will help us to generalize use cases
   */
  customJobs?:
    | CatladderJob[]
    | ((context: Omit<ComponentContext, "customJobs">) => CatladderJob[]);

  /**
   * whether to create a .env
   *
   * Be careful, this will overwrite any existing .env file!
   *
   * if set to true it will create .env locally and during build.
   * Be careful: the .env file usually ends up in the build artifacts.
   * Use this for apps and clients where env does not contain any secrets
   *
   *
   * if set to "local" it will only create .env file locally.
   * Use this in combination with @dotenvx/dotenvx or node 20 to start apps locally with .env files
   * During build and runtime, it relies on the env vars set in the environment
   *
   * @defaultValue true
   *
   */
  dotEnv?: boolean | "local";
  /**
   * whether to create a env.d.ts localy and during build jobs
   *
   * @defaultValue true
   */
  envDTs?: boolean;
} & DefaultEnvConfig;

export type ConfigProps = {
  CustomEnvs: string;
};

export type Config<C extends ConfigProps = never> = {
  /**
   * the pipeline type to generate, defaults to gitlab
   */
  pipelineType?: PipelineType;

  /**
   * name of the customer or group
   */
  customerName: string;
  /**
   * name of the app / project
   */
  appName: string;
  /**
   * if a env does not define a host, it will generate a canonical one (e.g. for review, dev and stage).
   * This prop specifies the domain that is used for these urls.
   *
   */
  domainCanonical?: string;

  agents?: Record<string, AgentConfig>;

  // shared workspace Builds
  builds?: Record<string, WorkspaceBuildConfig>;
  /**
   * components (sub apps)
   */
  components: Record<string, ComponentConfig<C>>;

  /**
   * additional meta data (only for organisational purposes)
   */
  meta?: {
    labels?: Record<string, string>;
  };

  /**
   * additional vars only for the runner in all jobs.
   */
  runnerVariables?: Record<string, string>;
};
