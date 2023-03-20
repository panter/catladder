import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createCustomBuildJobs } from "./buildJob";
import { createCustomTestJobs } from "./testJob";

export const createCustomJobs = (context: Context): CatladderJob[] => {
  return [...createCustomTestJobs(context), ...createCustomBuildJobs(context)];
};
