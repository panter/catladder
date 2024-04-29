import type { SecretEnvVar } from "../context";
import type {
  PipelineTrigger,
  ComponentConfig,
  Config,
  EnvType,
} from "./config";

export type EnvironmentEnvVars = {
  envVars: Record<string, string>;
  secretEnvVarKeys: SecretEnvVar[];
};
export type EnvironmentEnvVarPart = {
  host: string;
  url: string;

  /**
   * vars that only are injected in certain jobs, but not elsewhere
   */
  jobOnlyVars: {
    deploy: EnvironmentEnvVars;
    build: EnvironmentEnvVars;
  };
} & EnvironmentEnvVars;
export type Environment = {
  host: string;
  url: string;
  /**
   * the full name of the app. We use this as RELEASE_NAME in kubernetes and the service name in google cloud run
   */
  fullName: string;

  gitlabEnvironment: {
    name: string;
    url?: string;
  };
  shortName: string;
  slugPrefix: string;
  slug: string;

  envType: EnvType;
} & EnvironmentEnvVarPart;

export type CommitInfo = {
  refName: string;
  reviewSlug: string;
  buildTime: string;
  buildId: string;
  trigger: PipelineTrigger;
  currentVersion: string;
};

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
  commitInfo?: CommitInfo;
  packageManagerInfo?: PackageManagerInfo;
};
export type Context = {
  componentName: string;
  componentConfig: ComponentConfig;
  fullConfig: Config;
  environment: Environment;
  commitInfo?: CommitInfo;
  packageManagerInfo?: PackageManagerInfo;
};
