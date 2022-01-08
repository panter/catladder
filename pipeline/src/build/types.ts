export type BuildConfigBase = {
  startCommand?: string;
};

export type BuildConfigNode = {
  type: "node";
  buildCommand?: string | string[] | null;
} & BuildConfigBase;

export type BuildConfigNodeStatic = {
  type: "node-static";
  buildCommand?: string | string[] | null;
  startCommand?: never;
};

export type BuildConfigStorybook = {
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
