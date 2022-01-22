export type BuildConfigBase = {
  startCommand?: string;
  extraVars?: Record<string, string>;
};

export type BuildConfigNode = {
  type: "node";
  buildCommand?: string | string[] | null;
} & BuildConfigBase;

export type BuildConfigNodeStatic = BuildConfigBase & {
  type: "node-static";
  buildCommand?: string | string[] | null;
  startCommand?: never;
};

export type BuildConfigStorybook = BuildConfigBase & {
  type: "storybook";
  buildCommand?: string | string[] | null;
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
