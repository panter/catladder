import { Context } from "../types/context";

import { CatladderJob } from "../types/jobs";
import { createNodeJobs, createStorybookJobs, createMeteorJobs } from "./node";

import { BuildConfig } from "./types";
export * from "./types";
export * from "./node";

export type BuildTypes = {
  [type in BuildConfig["type"]]: {
    jobs: (context: Context) => CatladderJob[];
    defaults: () => Partial<Extract<BuildConfig, { type: type }>>;
  };
};

export const BUILD_TYPES: BuildTypes = {
  node: {
    jobs: createNodeJobs,
    defaults: () => ({
      buildCommand: "yarn build",
      startCommand: "yarn start",
    }),
  },
  "node-static": {
    jobs: createNodeJobs,
    defaults: () => ({
      buildCommand: "yarn build",
    }),
  },
  storybook: {
    jobs: createStorybookJobs,
    defaults: () => ({
      buildCommand: ["yarn build-storybook --quiet -o ./dist"],
    }),
  },
  meteor: {
    jobs: createMeteorJobs,
    defaults: () => ({
      startCommand: "node main.js",
    }),
  },
};
