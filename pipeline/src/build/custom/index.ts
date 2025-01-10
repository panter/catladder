import type { ComponentContextWithBuild } from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { createCustomBuildJobs } from "./buildJob";
import { createCustomTestJobs } from "./testJob";

export const createCustomJobs = (
  context: ComponentContextWithBuild,
): CatladderJob[] => {
  return [...createCustomTestJobs(context), ...createCustomBuildJobs(context)];
};
