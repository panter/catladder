import type { ComponentContextWithBuild } from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { createCustomBuildJobs } from "./buildJob";
import { createCustomTestJobs } from "./testJob";

export const createCustomJobs = async (
  context: ComponentContextWithBuild,
): Promise<CatladderJob[]> => {
  return [
    ...createCustomTestJobs(context),
    ...(await createCustomBuildJobs(context)),
  ];
};
