import type { ComponentContext, WorkspaceContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createNodeBuildJobs } from "./buildJob";
import { createMeteorBuildJobs } from "./meteor";
import { createNodeTestJobs } from "./testJob";

export const createNodeJobs = (
  context: ComponentContext | WorkspaceContext,
): CatladderJob[] => {
  return [...createNodeTestJobs(context), ...createNodeBuildJobs(context)];
};

export const createStorybookJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  return [...createNodeBuildJobs(context)];
};

export const createMeteorJobs = (context: ComponentContext): CatladderJob[] => {
  return [...createNodeTestJobs(context), ...createMeteorBuildJobs(context)];
};
