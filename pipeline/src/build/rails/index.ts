import type { Context } from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { createRailsBuildJobs } from "./build";
import { createRailsTestJobs } from "./test";

export const createRailsJobs = (context: Context): CatladderJob[] => {
  return [...createRailsTestJobs(context), ...createRailsBuildJobs(context)];
};
