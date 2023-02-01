import type { GitlabJobImage, GitlabJobService } from "../types";

export type BuildConfigBase = {
  /**
   * command to run on the image to start the app (e.g. yarn start)
   */
  startCommand?: string;
  /**
   * additional env vars for the buid jobs
   */
  extraVars?: Record<string, string>;
  /**
   * define the build command
   */
  buildCommand?: string | string[] | null;

  /**
   * customize docker build
   */
  docker?: {
    additionsBegin?: string[];
    additionsEnd?: string[];
  };

  /**
   * customize lint, set false to disable
   */
  lint?:
    | false
    | {
        command?: string | string[];
        jobImage?: GitlabJobImage;
      };

  /**
   * customize test, set false to disable
   */
  test?:
    | false
    | {
        command?: string | string[];
        jobImage?: GitlabJobImage;
      };

  /**
   * customize audit, set false to disable
   */
  audit?:
    | false
    | {
        command?: string | string[];
        jobImage?: GitlabJobImage;
      };

  /**
   * additional paths for artifacts,
   * by default "dist" and ".next" are allways included
   */
  artifactsPaths?: string[];

  /**
   * additional CI/CD artifacts reports,
   * use to display information in merge requests, pipeline views and security dashboards.
   */
  artifactsReports?: {
    /**
     * The junit report collects JUnit report format XML files.
     * The collected Unit test reports upload to GitLab as an artifact.
     * Paths are prefixed with component's root folder.
     * eg. `["dist/test-results/TEST-*.xml", "dist/rspec.xml", ...]`
     */
    junit?: string[];
  }
};

export type BuildConfigNodeBase = BuildConfigBase;

export type BuildConfigNode = {
  type: "node";
} & BuildConfigNodeBase;

export type BuildConfigNodeStatic = BuildConfigNodeBase & {
  type: "node-static";
  startCommand?: never;
};

export type BuildConfigMeteor = BuildConfigNodeBase & {
  type: "meteor";
  /**
   * whether to run yarn install inside the source folder in the docker image.
   * This is only required if you have custom scripts in your image
   */
  installScripts?: boolean;
};

export type BuildConfigCustomDocker = BuildConfigBase["docker"] &
  (
    | {
        /**
         * use the built-in nginx image for simple static apps
         */
        type: "nginx";
      }
    | {
        /**
         * custom docker build, expect that a Dockerfile in your directory
         */
        type: "custom";
      }
  );

export type BuildConfigCustom = BuildConfigBase & {
  type: "custom";
  jobImage: string;
  jobServices?: GitlabJobService[];
  docker: BuildConfigCustomDocker;
};

export type BuildConfigRails = BuildConfigBase & {
  type: "rails";
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
    buildVars?: Record<string, string | undefined>
  }
};

export type BuildConfigStorybook = BuildConfigNodeBase & {
  type: "storybook";
  startCommand?: never;
};
export type BuildConfig =
  | BuildConfigNode
  | BuildConfigNodeStatic
  | BuildConfigStorybook
  | BuildConfigMeteor
  | BuildConfigCustom
  | BuildConfigRails;

export type BuildConfigType = BuildConfig["type"];

export type BuildConfigGeneric<T extends BuildConfigType> = Extract<
  BuildConfig,
  { type: T }
>;

export const isOfBuildType = <T extends Array<BuildConfigType>>(
  t: BuildConfig,
  ...types: T
): t is Extract<BuildConfig, { type: T[number] }> => {
  return types.includes(t.type);
};
