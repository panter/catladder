import { ComponentConfig, Config, EnvType } from "./config";

export type Environment = {
  hostname: string;
  fullName: string;
  shortName: string;
  slug: string;
  url: string;
  variables: Record<string, string>;
  envType: EnvType;
};

export type CommitInfo = {
  refName: string;
  refSlug: string;
};
export type Context = {
  componentConfig: ComponentConfig;
  componentName: string;
  fullConfig: Config;
  environment: Environment;
  commit: CommitInfo;
};
