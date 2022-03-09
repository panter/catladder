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
      };

  /**
   * customize test, set false to disable
   */
  test?:
    | false
    | {
        command?: string | string[];
      };

  /**
   * customize audit, set false to disable
   */
  audit?:
    | false
    | {
        command?: string | string[];
      };

  /**
   * additional paths for artifacts,
   * by default "dist" and ".next" are allways included
   */
  artifactsPaths?: [];
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
};

export type BuildConfigStorybook = BuildConfigNodeBase & {
  type: "storybook";
  startCommand?: never;
};
export type BuildConfig =
  | BuildConfigNode
  | BuildConfigNodeStatic
  | BuildConfigStorybook
  | BuildConfigMeteor;

export const isOfBuildType = <T extends Array<BuildConfig["type"]>>(
  t: BuildConfig,
  ...types: T
): t is Extract<BuildConfig, { type: T[number] }> => {
  return types.includes(t.type);
};
