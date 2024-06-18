import { BUILD_TYPES } from "../build";
import { DEPLOY_TYPES } from "../deploy";
import type { ComponentContext } from "../types/context";
import type { CatladderJob } from "../types/jobs";

const injectDefaultVarsInCustomJobs = (
  context: ComponentContext,
  jobs: CatladderJob[],
) =>
  jobs.map(({ variables, ...job }) => ({
    variables: {
      ...(context.environment.envVars ?? {}),
      ...(variables ?? {}),
    },
    ...job,
  }));
const getCustomJobs = (context: ComponentContext) => {
  if (!context.customJobs) {
    return [];
  }
  const rawJobs = context.customJobs;
  return injectDefaultVarsInCustomJobs(context, rawJobs);
};
export const createJobsForComponentContext = (
  context: ComponentContext,
): CatladderJob[] => {
  const buildJobs = BUILD_TYPES[context.build.config.type].jobs(context);
  const deployJobs = context.deploy?.config
    ? DEPLOY_TYPES[context.deploy?.config.type].jobs(context)
    : [];

  const customJobs = getCustomJobs(context);
  return [...buildJobs, ...deployJobs, ...customJobs];
};
