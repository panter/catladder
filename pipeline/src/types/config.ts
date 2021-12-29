import { BuildConfig } from "../build/types";
import { DeployConfig } from "../deploy/types";

export type PipelineTrigger = "mainBranch" | "mr" | "taggedRelease";

export const ENV_TYPES = {
  dev: {
    trigger: "mainBranch",
  },
  review: {
    trigger: "mr",
  },
  prod: {
    trigger: "taggedRelease",
  },
  stage: {
    trigger: "taggedRelease",
  },
} as const;
export type EnvType = keyof typeof ENV_TYPES;

export const isKnowEnvType = (env: string): env is EnvType => {
  return env in ENV_TYPES;
};

export type DefaultEnvConfig = {
  deploy: DeployConfig | false;
  build: BuildConfig;
  vars?: {
    public?: Record<string, any>;
    secret?: Record<string, string>;
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
  dev?: EnvConfig<"dev">;
  stage?: EnvConfig<"stage">;
  review?: EnvConfig<"review">;
  prod?: EnvConfig<"prod">;
} & Record<string, EnvConfig>;

export type ComponentConfig = {
  env?: Env;
  dir: string;
} & DefaultEnvConfig;

export type Config = {
  customerName: string;
  appName: string;
  components: Record<string, ComponentConfig>;
};
