import type {
  PipelineTrigger,
  ComponentConfig,
  Config,
  EnvType,
} from "./config";

export type Environment = {
  host: string;
  url: string;
  /**
   * the full name of the app. We use this as RELEASE_NAME in kubernetes and the service name in google cloud run
   */
  fullName: string;
  gitlabEnvironment: {
    name: string;
    url: string;
  };
  shortName: string;
  slug: string;
  /**
   * env vars contain all build-time env vars. secrets have to be resolved (they are stored in gitlab)
   */
  envVars: Record<string, string>;
  envType: EnvType;
  secretEnvVarKeys: string[];
};

export type CommitInfo = {
  refName: string;
  reviewSlug: string;
  buildTime: string;
  buildId: string;
  trigger: PipelineTrigger;
};

type Workspace = {
  name: string;
  location: string;
  workspaceDependencies: string[];
  mismatchedWorkspaceDependencies: string[];
};
export type YarnPackageManagerInfo = {
  type: "yarn";
  version: string;
  workspaces: Workspace[];
  currentWorkspace?: Workspace;
  isClassic: boolean;
  componentIsInWorkspace: boolean;
  pathsToCopyInDocker: string[];
};

export type PackageManagerInfo = YarnPackageManagerInfo;
export type Context = {
  componentName: string;
  componentConfig: ComponentConfig;
  fullConfig: Config;
  environment: Environment;
  commitInfo?: CommitInfo;
  packageManagerInfo?: PackageManagerInfo;
};
