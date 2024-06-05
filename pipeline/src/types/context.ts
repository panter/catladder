import type { StringOrBashExpression } from "../bash/BashExpression";
import type { PredefinedVariables, SecretEnvVar } from "../context";
import type {
  PipelineTrigger,
  ComponentConfig,
  Config,
  EnvType,
} from "./config";
import type { BaseStage, CatladderJob } from "./jobs";
import type { PipelineType } from "./pipeline";

export type UnspecifiedEnvVars = Record<
  string,
  StringOrBashExpression | undefined | null
>;

export type EnvironmentEnvVars<
  V extends UnspecifiedEnvVars = UnspecifiedEnvVars
> = {
  envVars: V & UnspecifiedEnvVars;
  secretEnvVarKeys: SecretEnvVar[];
};
export type EnvironmentEnvVarPart = {
  host: StringOrBashExpression;
  url: StringOrBashExpression;

  /**
   * vars that only are injected in certain jobs, but not elsewhere
   */
  jobOnlyVars: {
    deploy: EnvironmentEnvVars;
    build: EnvironmentEnvVars;
  };
} & EnvironmentEnvVars<PredefinedVariables>;
// FIXME: align with EnvironmentContext
export type Environment = {
  host: StringOrBashExpression;
  url: StringOrBashExpression;
  /**
   * the full name of the app. We use this as RELEASE_NAME in kubernetes and the service name in google cloud run
   */
  fullName: StringOrBashExpression;

  shortName: string;
  /**
   * the environment slug without component name.
   */
  slugPrefix: StringOrBashExpression;
  /**
   * the review slug, if it is a review app, null otherwise
   */
  reviewSlug: StringOrBashExpression | null;
  /**
   * the full environment slug, including the componentName
   */
  slug: StringOrBashExpression;

  envType: EnvType;
} & EnvironmentEnvVarPart;

export type YarnWorkspace = {
  name: string;
  location: string;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: string[];
};
export type YarnPackageManagerInfo = {
  type: "yarn";
  version: string;
  workspaces: YarnWorkspace[];
  currentWorkspace?: YarnWorkspace;
  isClassic: boolean;
  componentIsInWorkspace: boolean;
  pathsToCopyInDocker: string[];
  currentWorkspaceDependencies: string[];
};

export type PackageManagerInfo = YarnPackageManagerInfo;

export type ContextBeforeConfig = {
  componentName: string;
  fullConfig: Config;
  packageManagerInfo?: PackageManagerInfo;
};
export type Context = {
  componentName: string;
  componentConfig: ComponentConfig;
  fullConfig: Config;
  environment: Environment;

  trigger?: PipelineTrigger;
  pipelineType?: PipelineType;
  packageManagerInfo?: PackageManagerInfo;
};

export type CatladderJobWithContext<S = BaseStage> = CatladderJob<S> & {
  context: Context;
};
