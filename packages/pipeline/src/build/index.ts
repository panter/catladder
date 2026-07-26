import type {
  ComponentContextWithBuild,
  PackageManagerType,
  WorkspaceContext,
} from "../types/context";
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

/**
 * run a package.json script with the project's package manager
 * (`yarn build` / `pnpm build`)
 */
const runScript = (packageManager: PackageManagerType, script: string) =>
  `${packageManager} ${script}`;

export type BuildTypes = {
  [type in BuildConfigStandaloneType]: {
    jobs: (
      context: ComponentContextWithBuild,
    ) => CatladderJob[] | Promise<CatladderJob[]>;
    defaults: (
      envContext: EnvironmentContext,
      packageManager: PackageManagerType,
    ) => Partial<Extract<BuildConfig, { type: type }>>;
  };
};

export const BUILD_TYPES: BuildTypes = {
  node: {
    jobs: createNodeJobs,
    defaults: (_, pm) => ({
      buildCommand: runScript(pm, "build"),
      startCommand: runScript(pm, "start"),
      artifactsPaths: ["dist", ".next"],
      artifactsExcludePaths: [".next/cache/**/*"],
    }),
  },
  "node-static": {
    jobs: createNodeJobs,
    defaults: (_, pm) => ({
      buildCommand: runScript(pm, "build"),
      artifactsPaths: ["dist"],
    }),
  },
  storybook: {
    jobs: createStorybookJobs,
    defaults: (_, pm) => ({
      buildCommand: [runScript(pm, "build-storybook --quiet -o ./dist")],
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
      cnbBuilder: {
        image: "heroku/builder:24",
        packVersion: "0.36.4",
      },
    }),
  },
};

export type WorkspaceBuildTypes = {
  [type in WorkspaceBuildConfig["type"]]: {
    jobs: (
      context: WorkspaceContext,
    ) => CatladderJob[] | Promise<CatladderJob[]>;
    defaults: (
      packageManager: PackageManagerType,
    ) => Partial<Extract<WorkspaceBuildConfig, { type: type }>>;
  };
};

export const WORKSPACE_BUILD_TYPES: WorkspaceBuildTypes = {
  node: {
    jobs: createNodeJobs,
    defaults: (pm) => ({
      buildCommand: runScript(pm, "build"),
      lint: {
        command: runScript(pm, "lint"),
      },
      test: {
        command: runScript(pm, "test"),
      },
    }),
  },
};
