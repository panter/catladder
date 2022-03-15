import type { Context } from "../../types/context";
import { CatladderJob } from "../../types/jobs";
import { createNodeBuildJobs } from "./buildJob";
import { createMeteorBuildJobs } from "./meteor";
import { createNodeTestJobs } from "./testJob";

export const createNodeJobs = (context: Context): CatladderJob[] => {
  return [...createNodeTestJobs(context), ...createNodeBuildJobs(context)];
};

export const createStorybookJobs = (context: Context): CatladderJob[] => {
  return [...createNodeBuildJobs(context)];
};

export const createMeteorJobs = (context: Context): CatladderJob[] => {
  return [...createNodeTestJobs(context), ...createMeteorBuildJobs(context)];
};
