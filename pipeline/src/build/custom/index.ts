import type { ComponentContext } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createCustomBuildJobs } from "./buildJob";
import { createCustomTestJobs } from "./testJob";

export const createCustomJobs = (context: ComponentContext): CatladderJob[] => {
  return [...createCustomTestJobs(context), ...createCustomBuildJobs(context)];
};
