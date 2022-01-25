export type BuildConfigBase = {
  startCommand?: string;
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
};

export type BuildConfigNodeBase = BuildConfigBase;

export type BuildConfigNode = {
  type: "node";
} & BuildConfigNodeBase;

export type BuildConfigNodeStatic = BuildConfigNodeBase & {
  type: "node-static";
  startCommand?: never;
};

export type BuildConfigStorybook = BuildConfigNodeBase & {
  type: "storybook";
  startCommand?: never;
};
export type BuildConfig =
  | BuildConfigNode
  | BuildConfigNodeStatic
  | BuildConfigStorybook;

export const isOfBuildType = <T extends BuildConfig["type"]>(
  t: BuildConfig,
  type: T
): t is Extract<BuildConfig, { type: T }> => {
  return t.type === type;
};
