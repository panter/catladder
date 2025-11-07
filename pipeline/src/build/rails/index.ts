import type { ComponentContextWithBuild } from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { createRailsBuildJobs } from "./build";
import { createRailsTestJobs } from "./testJob";

export const createRailsJobs = (
  context: ComponentContextWithBuild,
): CatladderJob[] => {
  return [...createRailsTestJobs(context), ...createRailsBuildJobs(context)];
};
