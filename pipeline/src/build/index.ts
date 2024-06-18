import type { ComponentContext, WorkspaceContext } from "../types/context";
import type { EnvironmentContext } from "../types/environmentContext";

import type { CatladderJob } from "../types/jobs";
import { createCustomJobs } from "./custom";
import { createMeteorJobs, createNodeJobs, createStorybookJobs } from "./node";
import { createRailsJobs } from "./rails";

import type {
  BuildConfig,
  BuildConfigStandaloneType,
  WorkspaceBuildConfig,
} from "./types";
export * from "./node";
export * from "./types";

export type BuildTypes = {
  [type in BuildConfigStandaloneType]: {
    jobs: (context: ComponentContext) => CatladderJob[];
    defaults: (
      envContext: EnvironmentContext,
    ) => Partial<Extract<BuildConfig, { type: type }>>;
  };
};

export const BUILD_TYPES: BuildTypes = {
  node: {
    jobs: createNodeJobs,
    defaults: () => ({
      buildCommand: "yarn build",
      startCommand: "yarn start",
      artifactsPaths: ["dist", ".next"],
    }),
  },
  "node-static": {
    jobs: createNodeJobs,
    defaults: () => ({
      buildCommand: "yarn build",
      artifactsPaths: ["dist"],
    }),
  },
  storybook: {
    jobs: createStorybookJobs,
    defaults: () => ({
      buildCommand: ["yarn build-storybook --quiet -o ./dist"],
      artifactsPaths: ["dist"],
    }),
  },
  meteor: {
    jobs: createMeteorJobs,
    defaults: () => ({
      startCommand: "node main.js",
      artifactsPaths: ["dist"],
    }),
  },
  custom: {
    jobs: createCustomJobs,
    defaults: () => ({
      artifactsPaths: ["dist"],
    }),
  },
  rails: {
    jobs: createRailsJobs,
    defaults: () => ({
      startCommand: "/cnb/process/web",
      cnbBuilder: {
        image: "heroku/builder:22",
        packVersion: "0.32.1",
      },
    }),
  },
};

export type WorkspaceBuildTypes = {
  [type in WorkspaceBuildConfig["type"]]: {
    jobs: (context: WorkspaceContext) => CatladderJob[];
    defaults: () => Partial<Extract<WorkspaceBuildConfig, { type: type }>>;
  };
};

export const WORKSPACE_BUILD_TYPES: WorkspaceBuildTypes = {
  node: {
    jobs: createNodeJobs,
    defaults: () => ({
      buildCommand: "yarn build",
      lint: {
        command: "yarn lint",
      },
      test: {
        command: "yarn test",
      },
    }),
  },
};
