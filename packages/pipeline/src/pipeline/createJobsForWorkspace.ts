import { WORKSPACE_BUILD_TYPES } from "../build";
import {
  assertUniquePostBuildTestNames,
  createPostBuildTestJobs,
} from "../postBuildTest/createPostBuildTestJobs";
import type { WorkspaceContext } from "../types/context";
import type { CatladderJob } from "../types/jobs";

export const createJobsForWorkspace = async (
  context: WorkspaceContext,
): Promise<CatladderJob[]> => {
  const [buildJobs, postBuildTestJobs] = await Promise.all([
    WORKSPACE_BUILD_TYPES[context.build.buildType].jobs(context),
    createPostBuildTestJobs(context),
  ]);
  assertUniquePostBuildTestNames(context, postBuildTestJobs, buildJobs);

  return [...buildJobs, ...postBuildTestJobs];
};
