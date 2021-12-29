export type BuildConfigBase = {
  startCommand?: string;
};

export type BuildConfigNode = {
  type: "node";
  buildCommand?: string | string[];
} & BuildConfigBase;

export type BuildConfigNodeStatic = {
  type: "node-static";
  buildCommand?: string | string[];
  startCommand?: never;
};

export type BuildConfigStorybook = {
  type: "storybook";
  buildCommand?: string | string[];
  startCommand?: never;
};
export type BuildConfig =
  | BuildConfigNode
  | BuildConfigNodeStatic
  | BuildConfigStorybook;

export const isOfType = <T extends BuildConfig["type"]>(
  t: BuildConfig,
  type: T
): t is Extract<BuildConfig, { type: T }> => {
  return t.type === type;
};
