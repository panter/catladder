import type { StringOrBashExpression } from "../bash/BashExpression";
import type { BuildConfig } from "../build";
import type { DeployConfig } from "../deploy";
import type { Config, EnvConfigWithComponent, EnvType } from "./config";
import type { PipelineType } from "./pipeline";

export type EnvironmentContext<
  B extends BuildConfig = BuildConfig,
  D extends DeployConfig = DeployConfig,
> = {
  envConfigRaw: EnvConfigWithComponent;
  buildConfigRaw: false | B;
  deployConfigRaw: false | D;

  env: string;
  envType: EnvType;
  componentName: string;
  fullName: StringOrBashExpression;
  /**
   * the environment slug without component name.
   */
  environmentSlugPrefix: StringOrBashExpression;
  /**
   * the review slug, if it is a review app, null otherwise
   */
  reviewSlug: StringOrBashExpression | null;
  /**
   * the full environment slug, including the componentName
   */
  environmentSlug: StringOrBashExpression;

  /**
   * the full catladder config
   */
  fullConfig: Config;

  pipelineType?: PipelineType;
};
