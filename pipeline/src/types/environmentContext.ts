import type { BuildConfigGeneric, BuildConfigType } from "../build";
import type { DeployConfigGeneric } from "../deploy";
import type { DeployConfigType } from "../deploy";
import type { Config, EnvConfigWithComponent, EnvType } from "./config";
import type { CommitInfo } from "./context";

export type EnvironmentContext<
  B extends BuildConfigType,
  D extends DeployConfigType
> = {
  envConfigRaw: EnvConfigWithComponent;
  buildConfigRaw: false | BuildConfigGeneric<B>;
  deployConfigRaw: false | DeployConfigGeneric<D>;
  commitInfo?: CommitInfo;
  env: string;
  envType: EnvType;
  componentName: string;
  fullName: string;
  /**
   * the environment slug without component name.
   */
  environmentSlugPrefix: string;
  /**
   * the full environment slug, including the componentName
   */
  environmentSlug: string;
  gitlabEnvironmentName: string;

  /**
   * the full catladder config
   */
  fullConfig: Config;
};
