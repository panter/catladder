import { BuildConfig } from "../build/types";
import { DeployConfig } from "../deploy/types";
import { PartialDeep } from "type-fest";
export type PipelineTrigger = "mainBranch" | "mr" | "taggedRelease";

/**
 * all env types with their trigger.
 * Each env type has a default env with the same name which is always included
 */
export const ENV_TYPES = {
  dev: {
    triggers: ["mainBranch", "taggedRelease"], // we also trigger dev on tagged release, so that the versions match
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
      (e.triggers as readonly PipelineTrigger[]).includes(trigger)
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
   * public env vars (means: they are checked in the repo)
   */
  public?: Record<string, any>;
  /**
   * secret env vars. These vars can be managed with catladder/cli
   */
  secret?: string[];
  /**
   * With fromComponents you can inject env vars from other components.
   */
  fromComponents?: {
    [otherApp: string]: Record<string, string>;
  };
};

export type DefaultEnvConfig = {
  /**
   * how the app is deployed
   */
  deploy: DeployConfig | false;
  /**
   * how the app is built and its runtime
   */
  build: BuildConfig;
  /**
   * environment variables
   */
  vars?: EnvVars;
};

export type DevLocalEnvConfig = {
  vars?: EnvVars;
  port?: number;
};
export type EnvConfig<E extends EnvType = EnvType> = {
  /**
   * type of the env (stage, prod, review, dev)
   */
  type?: E;
  /**
   * hostname that is used. If not set, a "canonical" url is created
   */
  hostname?: string;
} & PartialDeep<DefaultEnvConfig>;

export type Env = {
  /**
   * local is a special env that is only used in local development
   */
  local?: DevLocalEnvConfig;

  dev?: EnvConfig<"dev"> | false;
  stage?: EnvConfig<"stage"> | false;
  review?: EnvConfig<"review"> | false;
  prod?: EnvConfig<"prod"> | false;
} & Record<string, EnvConfig | false>;

export type ComponentConfig = {
  /**
   * specify environment configurations
   */
  env?: Env;
  /**
   * the directory of the component (e.g. where the package.json or similar is located). You can set "." if you only have one app.
   */
  dir: string;
} & DefaultEnvConfig;

export type Config = {
  /**
   * name of the customer or group
   */
  customerName: string;
  /**
   * name of the app / project
   */
  appName: string;
  /**
   * if a env does not define a hostname, it will generate a canonical one (e.g. for review, dev and stage).
   * This prop specifies the domain that is used for these urls.
   *
   */
  domainCanonical?: string;
  /**
   * components (sub apps)
   */
  components: Record<string, ComponentConfig>;

  /**
   * additional meta data (only for organisational purposes)
   */
  meta?: {
    labels?: Record<string, string>;
  };
};
