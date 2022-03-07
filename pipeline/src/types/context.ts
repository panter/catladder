import { PipelineTrigger, ComponentConfig, Config, EnvType } from "./config";

export type Environment = {
  host: string;
  fullName: string;
  shortName: string;
  slug: string;
  url: string;
  /**
   * env vars contain all build-time env vars. secrets have to be resolved (they are stored in gitlab)
   */
  envVars: Record<string, string>;
  envType: EnvType;
  secretEnvVarKeys: string[];
};

export type CommitInfo = {
  refName: string;
  refSlug: string;
  buildTime: string;
  buildId: string;
  trigger: PipelineTrigger;
};

export type YarnInfo = {
  version: string;
  workspaces: { location: string }[];
  isClassic: boolean;
  componentIsInWorkspace: boolean;
  /**
   * files relevant for the package manager
   */
  files: string[];
};
export type Context = {
  componentName: string;
  componentConfig: ComponentConfig;
  fullConfig: Config;
  environment: Environment;
  commitInfo?: CommitInfo;
  yarnInfo?: YarnInfo;
};
