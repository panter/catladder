import type { StringOrBashExpression } from "@catladder/bash";
import type { BuildConfig } from "../build";
import type { DeployConfig } from "../deploy";
import type { Config, EnvConfigWithComponent, EnvType } from "./config";
import type { PipelineType } from "./pipeline";

/**
 * how an environment is instantiated:
 * - "stable": one long-lived instance (dev, stage, prod, branch envs)
 * - "review": one instance per merge/pull request (`on: "mr"`),
 *   addressed by the runtime review slug (mr<iid> / pr<number>)
 */
export type EnvironmentInstance =
  | { type: "stable" }
  | { type: "review"; reviewSlug: StringOrBashExpression };

export type EnvironmentContext<
  B extends BuildConfig = BuildConfig,
  D extends DeployConfig = DeployConfig,
> = {
  envConfigRaw: EnvConfigWithComponent;
  buildConfigRaw: false | B;
  deployConfigRaw: false | D;

  env: string;
  envType: EnvType;
  /**
   * the resolved autoStop config (component override, then project-wide
   * environment config); undefined means the env type's default applies
   */
  autoStop?: string | false;
  componentName: string;
  fullName: StringOrBashExpression;
  /**
   * the environment slug without component name.
   */
  environmentSlugPrefix: StringOrBashExpression;
  /**
   * how the env is instantiated — `instance.type === "review"` is the
   * way to find out whether this is a review app
   */
  instance: EnvironmentInstance;
  /**
   * the review slug, if it is a review app, null otherwise
   * @deprecated use `instance` — the review variant carries the slug
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
