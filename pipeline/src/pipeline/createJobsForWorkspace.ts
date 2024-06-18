import { WORKSPACE_BUILD_TYPES } from "../build";
import type { WorkspaceContext } from "../types/context";
import type { CatladderJob } from "../types/jobs";

export const createJobsForWorkspace = (
  context: WorkspaceContext,
): CatladderJob[] => {
  const buildJobs =
    WORKSPACE_BUILD_TYPES[context.build.buildType].jobs(context);

  return buildJobs;
};
