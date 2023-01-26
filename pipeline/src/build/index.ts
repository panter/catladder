import type { Context } from "../types/context";
import type { EnvironmentContext } from "../types/environmentContext";

import type { CatladderJob } from "../types/jobs";
import { createCustomJobs } from "./custom";
import { createNodeJobs, createStorybookJobs, createMeteorJobs } from "./node";
import { createRailsJobs } from "./rails";

import type { BuildConfig, BuildConfigType } from "./types";
export * from "./types";
export * from "./node";

export type BuildTypes = {
  [type in BuildConfigType]: {
    jobs: (context: Context) => CatladderJob[];
    defaults: (
      envContext: EnvironmentContext<BuildConfigType, any>
    ) => Partial<Extract<BuildConfig, { type: type }>>;
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
  custom: {
    jobs: createCustomJobs,
    defaults: () => ({}),
  },
  rails: {
    jobs: createRailsJobs,
    defaults: () => ({
      startCommand: "/cnb/process/web",
      cnbBuilder: {
        image: "heroku/buildpacks:20",
        packVersion: "0.28.0",
      }
    }),
  },
};
