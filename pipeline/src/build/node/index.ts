import type {
  ComponentContextWithBuild,
  WorkspaceContext,
} from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createNodeBuildJobs } from "./buildJob";
import { createMeteorBuildJobs } from "./meteor";
import { createNodeTestJobs } from "./testJob";

export const createNodeJobs = (
  context: ComponentContextWithBuild | WorkspaceContext,
): CatladderJob[] => {
  return [...createNodeTestJobs(context), ...createNodeBuildJobs(context)];
};

export const createStorybookJobs = (
  context: ComponentContextWithBuild,
): CatladderJob[] => {
  return [...createNodeBuildJobs(context)];
};

export const createMeteorJobs = (
  context: ComponentContextWithBuild,
): CatladderJob[] => {
  return [...createNodeTestJobs(context), ...createMeteorBuildJobs(context)];
};
