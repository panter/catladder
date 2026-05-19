import { WORKSPACE_BUILD_TYPES } from "../build";
import type { WorkspaceContext } from "../types/context";
import type { CatladderJob } from "../types/jobs";

export const createJobsForWorkspace = async (
  context: WorkspaceContext,
): Promise<CatladderJob[]> => {
  const buildJobs =
    await WORKSPACE_BUILD_TYPES[context.build.buildType].jobs(context);

  return buildJobs;
};
