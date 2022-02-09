import { Context } from "../../types";
import { CatladderJob } from "../../types/jobs";
import { createRailsBuildJobs } from "./build";
import { createRailsTestJobs } from "./test";

export const createRailsJobs = (context: Context): CatladderJob[] => {
  return [...createRailsTestJobs(context), ...createRailsBuildJobs(context)];
};
