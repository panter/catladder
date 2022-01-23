export type BuildConfigBase = {
  startCommand?: string;
  extraVars?: Record<string, string>;
};

export type BuildConfigNodeBase = {
  buildCommand?: string | string[] | null;
  docker?: {
    additionsBegin?: string[];
    additionsEnd?: string[];
  };
};

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
