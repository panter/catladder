import { BUILD_TYPES } from "../build";
import { DEPLOY_TYPES } from "../deploy";
import type {
  ComponentContext,
  ComponentContextWithBuild,
} from "../types/context";
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
  const buildJobs =
    context.build.type !== "disabled"
      ? BUILD_TYPES[context.build.buildType].jobs(
          context as ComponentContextWithBuild,
        )
      : [];
  const deployJobs =
    context.componentConfig.deploy !== false
      ? DEPLOY_TYPES[context.componentConfig.deploy.type].jobs(context)
      : [];

  const customJobs = getCustomJobs(context);

  return [...buildJobs, ...deployJobs, ...customJobs];
};
