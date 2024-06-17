import type { ComponentContext } from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { createRailsBuildJobs } from "./build";
import { createRailsTestJobs } from "./test";

export const createRailsJobs = (context: ComponentContext): CatladderJob[] => {
  return [...createRailsTestJobs(context), ...createRailsBuildJobs(context)];
};
