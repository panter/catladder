import type {
  ComponentContextWithBuild,
  WorkspaceContext,
} from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { createNodeBuildJobs } from "./buildJob";
import { createMeteorBuildJobs } from "./meteor";
import { createNodeTestJobs } from "./testJob";

export const createNodeJobs = async (
  context: ComponentContextWithBuild | WorkspaceContext,
): Promise<CatladderJob[]> => {
  const [testJobs, buildJobs] = await Promise.all([
    createNodeTestJobs(context),
    createNodeBuildJobs(context),
  ]);
  return [...testJobs, ...buildJobs];
};

export const createStorybookJobs = async (
  context: ComponentContextWithBuild,
): Promise<CatladderJob[]> => {
  return [...(await createNodeBuildJobs(context))];
};

export const createMeteorJobs = async (
  context: ComponentContextWithBuild,
): Promise<CatladderJob[]> => {
  const [testJobs, buildJobs] = await Promise.all([
    createNodeTestJobs(context),
    createMeteorBuildJobs(context),
  ]);
  return [...testJobs, ...buildJobs];
};
