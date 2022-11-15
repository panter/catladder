import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createCustomBuildJobs } from "./buildJob";

export const createCustomJobs = (context: Context): CatladderJob[] => {
  return [...createCustomBuildJobs(context)];
};
