import { Context } from "../types/context";
import { GitlabJobs } from "../types/gitlab-types";
import { createNodeJobs, createStorybookJobs } from "./node";
import { BuildConfig } from "./types";

type BuildTypes = {
  [type in BuildConfig["type"]]: {
    jobs: (context: Context) => GitlabJobs;
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
      buildCommand: ["yarn storybook", "mv ./storybook-out /dist"],
    }),
  },
};
