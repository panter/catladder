import type { Artifacts, EnvVars, GitlabJobImage } from "../types";
import type { Services } from "../types/gitlab-ci-yml";

import type { CatladderJob, CatladderJobCache } from "../types/jobs";

export type CacheConfigAdvanced = Omit<CatladderJobCache, "paths" | "key"> & {
  /**
   * if you set a key, the cache is scoped to the key. Be aware that there is a limit in gitlab of 4 caches.
   *
   * see https://gitlab.com/gitlab-org/gitlab/-/issues/421962
   */
  key: Required<CatladderJobCache>["key"];

  /**
   * whether the cache is scoped to the context (component or workspace) or the build directory.
   *
   * defaults to context
   */
  scope?: "context" | "buildDir" | "global";
} & CacheConfigSimple;

export type CacheConfigSimple = {
  /**
   * paths to cache. All Paths are relative to the context dir.
   */
  paths: string[];

  /**
   * whether paths are relative to the base dir. defaults to relative.
   */
  pathMode?: "relative" | "absolute";

  /**
   * custom base dir
   */
  baseDir?: string;
};

export type CacheConfig = CacheConfigSimple | CacheConfigAdvanced;

export type BuildConfigArtifactsReports = {
  /**
   * The junit report collects JUnit report format XML files.
   * The collected Unit test reports upload to GitLab as an artifact.
   * Paths are prefixed with component's root folder.
   * eg. `["dist/test-results/TEST-*.xml", "dist/rspec.xml", ...]`
   */
  junit?: string[];
};

export type WithCacheConfig = {
  /*
  cache config. All Paths are relative to the context dir.
  */
  cache?: CacheConfig | CacheConfig[];

  /**
   * customize cache for the job
   *
   * @deprecated use cache
   */
  jobCache?: CatladderJob["cache"];
};

export type TestJobCustom = {
  command?: string | string[];
  jobImage?: GitlabJobImage;
  /**
   * additional CI/CD artifacts reports,
   * use to display information in merge requests, pipeline views and security dashboards.
   */
  artifactsReports?: BuildConfigArtifactsReports;
  /**
   * GitLab {@link Artifacts} configuration.
   *
   * {@link TestJobCustom.artifacts}.reports.junit is merged with {@link TestJobCustom.artifactsReports} in case both given.
   */
  artifacts?: Artifacts;

  /**
   * additional vars for this job runner
   */
  runnerVariables?: Record<string, string>;

  /**
   * Whether the job is allowed to fail without blocking the pipeline.
   * Defaults to `true` for audit jobs, `undefined` (not set) for lint and test jobs.
   */
  allowFailure?: boolean;
};

export type BuildConfigBase = {
  /**
   * command to run on the image to start the app (e.g. yarn start)
   */
  startCommand?: string;

  /**
   * vars that only exist in the build jobs.
   * Can curently not reference other variables from other components
   */
  jobVars?: EnvVars;

  /**
   * additional vars only for the runner.
   * Also if you use services: that require env vars, you need to set them here.
   *
   */
  runnerVariables?: Record<string, string>;
  /**
   * define the build command
   */
  buildCommand?: string | string[] | null | false;

  /**
   * customize lint, set false to disable
   */
  lint?: false | TestJobCustom;

  /**
   * customize test, set false to disable
   */
  test?: false | TestJobCustom;

  /**
   * customize audit, set false to disable
   */
  audit?: false | TestJobCustom;

  /**
   * additional paths for artifacts,
   * by default "dist" and ".next" are allways included
   */
  artifactsPaths?: string[];

  /**
   * paths for artifacts to exclude,
   *
   */
  artifactsExcludePaths?: string[];

  /**
   * additional CI/CD artifacts reports,
   * use to display information in merge requests, pipeline views and security dashboards.
   */
  artifactsReports?: BuildConfigArtifactsReports;

  /**
   * customize cache for the job
   *
   * @deprecated use cache
   */
  jobCache?: CatladderJob["cache"];

  /**
   * tags for the underlying job runner (e.g gitlab)
   */
  jobTags?: string[];
  /**
   * custom image to use
   */
  jobImage?: GitlabJobImage;
} & WithCacheConfig;

export type BuildConfigNodeBase = BuildConfigBase & {
  /**
   * runs a command after yarn install. postinstall in package.json won't work for yarn plug and play.
   * the command will be invoked in the component dir.
   */
  postInstall?: string | string[];
};

export type BuildConfigNode = {
  type: "node";
  docker?: Omit<BuildConfigDockerBuiltInNode, "type"> | BuildConfigDocker;
} & BuildConfigNodeBase;

export type BuildConfigNodeStatic = BuildConfigNodeBase & {
  /**
   * @deprecated use `type: "node", startCommand: "", docker: { type: "nginx" }` instead
   */
  type: "node-static";
  startCommand?: never;
  docker?: Omit<BuildConfigDockerBuiltInNgninx, "type"> | BuildConfigDocker;
};

export type BuildConfigMeteor = BuildConfigNodeBase & {
  type: "meteor";
  /**
   * whether to run yarn install inside the source folder in the docker image.
   * This is only required if you have custom scripts in your image
   */
  installScripts?: boolean;
  docker?: Omit<BuildConfigDockerBuiltInMeteor, "type"> | BuildConfigDocker;
};

export type BuildConfigNodeLike =
  | BuildConfigNode
  | BuildConfigNodeStatic
  | BuildConfigStorybook
  | BuildConfigMeteor;

type BuildConfigDockerWithAdditions = {
  /**
   * Custom Dockerfile lines integrated in the generated Dockerfile before the standard build steps.
   *
   */
  additionsBegin?: string[];
  /**
   * Custom Dockerfile lines integrated in the generated Dockerfile after the standard build steps.
   *
   */
  additionsEnd?: string[];
};

type BuildConfigDockerBuiltInNode = {
  type: "node";
  /**
   * whether to run yarn rebuild after yarn install. Defaults to true.
   *
   * Future versions of catladder will default to false.
   */
  yarnRebuildEnabled?: boolean;
} & BuildConfigDockerWithAdditions;

type BuildConfigDockerBuiltInMeteor = {
  type: "meteor";
} & BuildConfigDockerWithAdditions;

type BuildConfigDockerBuiltInNgninx = {
  /**
   * use the built-in nginx image for simple static apps
   */
  type: "nginx";
} & BuildConfigDockerWithAdditions;
type BuildConfigDockerBuiltIn =
  | BuildConfigDockerBuiltInNgninx
  | BuildConfigDockerBuiltInNode
  | BuildConfigDockerBuiltInMeteor;

type BuildConfigDockerCustom = {
  /**
   * custom docker build, expect that a Dockerfile in your directory
   */
  type: "custom";

  /**
   * where to run the docker build, defaults to the root of the repo.
   *
   * Depending on your Dockerfile you may want to change it to "component"
   */
  buildContextLocation?: "root" | "component";

  /**
   * EXPERIMENTAL: custom docker file content
   *
   * you can use some predefined variables:
   * - $DOCKER_COPY_WORKSPACE_FILES
   * - $DOCKER_COPY_AND_INSTALL_APP
   * - and all default variables
   */
  dockerfileContent?: string[];
};

export type BuildConfigDocker =
  | BuildConfigDockerBuiltIn
  | BuildConfigDockerCustom;

export type BuildConfigCustom = Omit<
  BuildConfigBase,
  "lint" | "test" | "audit"
> & {
  type: "custom";
  jobImage: GitlabJobImage;
  /**
   * {@link Services}s used in lint, test, audit, and build jobs.
   */
  jobServices?: Services;

  docker: BuildConfigDocker;

  /**
   * custom lint, disabled when not set
   */
  lint?: TestJobCustom;

  /**
   * custom test, disabled when not set
   */
  test?: TestJobCustom;

  /**
   * custom audit, disabled when not set
   */
  audit?: TestJobCustom;
};

export type BuildConfigRails = BuildConfigBase & {
  type: "rails";
  test?: Pick<BuildConfigBase, "test"> & {
    /**
     * The container image to use as the database.
     * Currently only supports PostgreSQL.
     * Defaults to `docker.io/postgres:latest`
     */
    databaseImage?: string;
  };
  /**
   * The [Cloud Native Buildpacks](https://buildpacks.io/) builder configuration.
   *
   * Only applies when there is no `Dockerfile`.
   */
  cnbBuilder?: {
    /**
     * The Cloud Native Buildpacks builder image to use.
     * See e.g. https://github.com/heroku/builder or others.
     * Default: heroku/buildpacks:20
     */
    image?: string;
    /**
     * The version of the Cloud Native Buildpacks pack command to use.
     * See https://buildpacks.io/docs/tools/pack/
     * Default: 0.28.0
     */
    packVersion?: string;
    /**
     * Additional command arguments passed to the pack command.
     * See https://buildpacks.io/docs/tools/pack/
     */
    packExtraArgs?: string[];
    /**
     * Variables needed for Bundler and Rails asset precompilation.
     *
     * Specify a key with the value `undefined` to inherit it from the EnvVars.
     *
     * See https://github.com/rails/rails/issues/32947
     */
    buildVars?: Record<string, string | undefined>;
  };
};

export type BuildConfigStorybook = BuildConfigNodeBase & {
  /**
   * @deprecated use type: "node" and docker: { type: "nginx" } instead
   */
  type: "storybook";
  startCommand?: never;
};

export type BuildConfigFromWorkspace = {
  from: string;
  docker?: BuildConfigDocker;
  startCommand?: string;
  /**
   * additional paths for artifacts,
   * by default "dist" and ".next" are allways included
   */
  artifactsPaths?: string[];
  /**
   * paths for artifacts to exclude,
   *
   */
  artifactsExcludePaths?: string[];
} & WithCacheConfig;
export type BuildConfigStandalone =
  | BuildConfigNode
  | BuildConfigNodeStatic
  | BuildConfigStorybook
  | BuildConfigMeteor
  | BuildConfigCustom
  | BuildConfigRails;

export type BuildConfig = BuildConfigFromWorkspace | BuildConfigStandalone;

export type BuildConfigStandaloneType = BuildConfigStandalone["type"];

export type BuildConfigGeneric<T extends BuildConfigStandaloneType> = Extract<
  BuildConfig,
  { type: T }
>;

export const isStandaloneBuildConfig = (
  t: BuildConfig | false,
): t is BuildConfigStandalone => {
  if (!t) return false;
  return !("from" in t);
};

export const isOfBuildType = <T extends Array<BuildConfigStandaloneType>>(
  t: BuildConfig,
  ...types: T
): t is Extract<BuildConfig, { type: T[number] }> => {
  if (!isStandaloneBuildConfig(t)) return false;
  return types.includes(t.type);
};

export type WorkspaceBuildConfigBase = {
  dir?: string;
  /**
   * customize lint, set false to disable
   */
  lint?: false | TestJobCustom;

  /**
   * customize test, set false to disable
   */
  test?: false | TestJobCustom;

  /**
   * customize audit, set false to disable
   */
  audit?: false | TestJobCustom;
  /**
   * additional vars only for the build job.
   * Also if you use services: that require env vars, you need to set them here.
   *
   */
  runnerVariables?: Record<string, string>;

  /**
   * additional CI/CD artifacts reports,
   * use to display information in merge requests, pipeline views and security dashboards.
   */
  artifactsReports?: BuildConfigArtifactsReports;

  jobImage?: GitlabJobImage;
  /**
   * tags for the underlying job runner (e.g gitlab)
   */
  jobTags?: string[];
} & WithCacheConfig;

export type WorkspaceBuildConfigNode = {
  type: "node";
  buildCommand?: string | string[] | null | false;
  /**
   * set docker config defaults for the node build type.
   * Currently not all options are supported.
   */
  dockerDefaults?: Pick<BuildConfigDockerBuiltInNode, "yarnRebuildEnabled">;
} & WorkspaceBuildConfigBase;

export type WorkspaceBuildConfig = WorkspaceBuildConfigNode;
