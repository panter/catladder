import type { ComponentContextWithBuild } from "../../types";
import type { CatladderJob } from "../../types/jobs";
import { createRailsBuildJobs } from "./build";
import { createRailsTestJobs } from "./testJob";

export const createRailsJobs = async (
  context: ComponentContextWithBuild,
): Promise<CatladderJob[]> => {
  return [
    ...createRailsTestJobs(context),
    ...(await createRailsBuildJobs(context)),
  ];
};
