import { BuildConfig } from "../build/types";
import { DeployConfig } from "../deploy/types";

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

export type DefaultEnvConfig = {
  deploy: DeployConfig | false;
  build: BuildConfig;
  vars?: {
    public?: Record<string, any>;
    secret?: string[];
    fromComponents?: {
      [otherApp: string]: Record<string, string>;
    };
  };
};
type EnvConfig<E extends EnvType = EnvType> = {
  type?: E;
  hostname?: string;
} & Partial<DefaultEnvConfig>;

export type Env = {
  dev?: EnvConfig<"dev"> | false;
  stage?: EnvConfig<"stage"> | false;
  review?: EnvConfig<"review"> | false;
  prod?: EnvConfig<"prod"> | false;
} & Record<string, EnvConfig | false>;

export type ComponentConfig = {
  env?: Env;
  dir: string;
} & DefaultEnvConfig;

export type Config = {
  customerName: string;
  appName: string;
  components: Record<string, ComponentConfig>;
};
