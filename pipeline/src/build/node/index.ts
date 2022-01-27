import type { Context } from "../../types/context";
import type { GitlabJobs } from "../../types/gitlab-types";
import { createNodeBuildJobs } from "./buildJob";
import { createMeteorBuildJobs } from "./meteor";
import { createNodeTestJobs } from "./testJob";

export const createNodeJobs = (context: Context): GitlabJobs => {
  return [...createNodeTestJobs(context), ...createNodeBuildJobs(context)];
};

export const createStorybookJobs = (context: Context): GitlabJobs => {
  return [...createNodeBuildJobs(context)];
};

export const createMeteorJobs = (context: Context): GitlabJobs => {
  return [...createNodeTestJobs(context), ...createMeteorBuildJobs(context)];
};
