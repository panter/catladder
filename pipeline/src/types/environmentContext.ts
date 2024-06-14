import type { StringOrBashExpression } from "../bash/BashExpression";
import type { BuildConfigGeneric, BuildConfigType } from "../build";
import type { DeployConfigGeneric } from "../deploy";
import type { DeployConfigType } from "../deploy";
import type { Config, EnvConfigWithComponent, EnvType } from "./config";
import type { PipelineType } from "./pipeline";

export type EnvironmentContext<
  B extends BuildConfigType,
  D extends DeployConfigType,
> = {
  envConfigRaw: EnvConfigWithComponent;
  buildConfigRaw: false | BuildConfigGeneric<B>;
  deployConfigRaw: false | DeployConfigGeneric<D>;

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
