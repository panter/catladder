import type { StringOrBashExpression } from "@catladder/bash";
import type {
  BuildConfigFromWorkspace,
  BuildConfigStandalone,
  WorkspaceBuildConfig,
} from "../build";
import type { PredefinedVariables, SecretEnvVar } from "../context";
import type { DeployConfig } from "../deploy";
import type { VariableValue } from "@catladder/bash";
import type { AgentConfig } from "./agent";
import type {
  ComponentConfig,
  Config,
  EnvType,
  PipelineTrigger,
} from "./config";
import type { BaseStage, CatladderJob, CatladderJobSpec } from "./jobs";
import type { PipelineType } from "./pipeline";

export type UnspecifiedEnvVars = Record<
  string,
  VariableValue | undefined | null
>;

export type EnvironmentEnvVars<
  V extends UnspecifiedEnvVars = UnspecifiedEnvVars,
> = {
  envVars: V & UnspecifiedEnvVars;
  secretEnvVarKeys: SecretEnvVar[];
};
export type EnvironmentEnvVarPart = {
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
  /**
   * the full name of the app. We use this as RELEASE_NAME in kubernetes and the service name in google cloud run
   */
  fullName: StringOrBashExpression;

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
export type YarnPackageManagerInfoBase = {
  type: "yarn";
  version: string;
  workspaces: YarnWorkspace[];
  isClassic: boolean;
};

export type YarnPackageManagerInfoComponent = YarnPackageManagerInfoBase & {
  currentWorkspace?: YarnWorkspace;
  componentIsInWorkspace: boolean;
  pathsToCopyInDocker: string[];
  currentWorkspaceDependencies: string[];
};

export type PackageManagerInfoComponent = YarnPackageManagerInfoComponent;

/**
 * not confuse with yarn workspaces
 */
export type PackageManagerInfoBase = YarnPackageManagerInfoBase;

export type ContextBeforeConfig = {
  componentName: string;
  fullConfig: Config;
  packageManagerInfo?: Promise<PackageManagerInfoComponent>;
};

export type BuildContextBase = {
  /**
   * the directory where the component or workspace is located
   */
  dir: string;
  /**
   * directories of all components that are part of the build.
   * In case of a standalone build, this is just the dir of the component + yarn workspace dependencies (if mode = all)
   *
   * in case of a workspace this contains all components in the workspace (+ yarn workspace dependencies if mode = all)
   */
  getComponentDirs: (mode: "direct" | "all") => Promise<string[]>;
};

export type BuildContextComponentBase = BuildContextBase;

export type BuildContextStandalone<
  C extends BuildConfigStandalone = BuildConfigStandalone,
> = BuildContextComponentBase & {
  config: C;
  type: "standalone";
  buildType: C["type"];
};

export type BuildContextDisabled = BuildContextComponentBase & {
  type: "disabled";
};
export type BuildContextFromWorkspace = BuildContextComponentBase & {
  config: BuildConfigFromWorkspace;
  workspaceName: string;
  buildType: WorkspaceBuildConfig["type"];
  /**
   * merged docker config
   */
  workspaceBuildConfig: WorkspaceBuildConfig;
  type: "fromWorkspace";
};

export type BuildContextWorkspace = BuildContextBase & {
  type: "workspace";
  buildType: WorkspaceBuildConfig["type"];
  config: WorkspaceBuildConfig;
};

export type BuildContextWithBuild =
  | BuildContextStandalone
  | BuildContextFromWorkspace;

export type BuildContextComponent =
  | BuildContextWithBuild
  | BuildContextDisabled;

export type BuildContext = BuildContextComponent | BuildContextWorkspace;

export type DeployContext = {
  config: DeployConfig;
};
export type ComponentContext<
  BC extends BuildContextComponent = BuildContextComponent,
> = {
  type: "component";
  env: string;
  /**
   * the name of the component
   */
  name: string;

  /**
   * the merged component config.
   *
   * use build.config and deploy.config instead if you need something from there
   *
   */
  componentConfig: ComponentConfig;
  build: BC;
  deploy?: DeployContext | null;
  fullConfig: Config;
  environment: Environment;

  trigger?: PipelineTrigger;
  pipelineType?: PipelineType;

  packageManagerInfo: Promise<PackageManagerInfoComponent>;

  customJobs?: CatladderJobSpec[];
};

export type ComponentContextWithBuild = ComponentContext<BuildContextWithBuild>;

export type Context = ComponentContext | WorkspaceContext;

export type CatladderJobWithContext<S = BaseStage> = CatladderJob<S> & {
  context: ComponentContext;
};

export const componentContextIsStandaloneBuild = (
  context: ComponentContext<BuildContextComponent>,
): context is ComponentContext<BuildContextStandalone> => {
  return context.build.type === "standalone";
};

export const componentContextHasWorkspaceBuild = (
  context: ComponentContext<BuildContextComponent>,
): context is ComponentContext<BuildContextFromWorkspace> => {
  return context.build.type === "fromWorkspace";
};

export type WorkspaceContext = {
  type: "workspace";
  /**
   * the name of the workspace
   */
  name: string;
  fullConfig: Config;
  workspaceConfig: WorkspaceBuildConfig;
  packageManagerInfo: Promise<PackageManagerInfoBase>;
  components: Array<ComponentContext>;
  build: BuildContextWorkspace;
  trigger: PipelineTrigger;
  pipelineType: PipelineType;
  env: string;
};

export type { AgentContext } from "../pipeline/agent/createAgentContext";
