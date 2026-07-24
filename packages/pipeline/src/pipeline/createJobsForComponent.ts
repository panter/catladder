import { BUILD_TYPES } from "../build";
import { DEPLOY_TYPES } from "../deploy";
import type {
  ComponentContext,
  ComponentContextWithBuild,
} from "../types/context";
import type { CatladderJobSpec } from "../types/jobs";
import { CatladderJob } from "../types/jobs";
import { createVerifyJobs } from "../verify/createVerifyJobs";

const injectDefaultVarsInCustomJobs = (
  context: ComponentContext,
  jobs: CatladderJobSpec[],
) =>
  jobs.map(
    ({ variables, ...job }) =>
      new CatladderJob({
        variables: {
          ...(context.environment.envVars ?? {}),
          ...(variables ?? {}),
        },
        ...job,
      }),
  );
const getCustomJobs = (context: ComponentContext) => {
  if (!context.customJobs) {
    return [];
  }
  const rawJobs = context.customJobs;
  return injectDefaultVarsInCustomJobs(context, rawJobs);
};
export const createJobsForComponentContext = async (
  context: ComponentContext,
): Promise<CatladderJob[]> => {
  const [buildJobs, deployJobs, verifyJobs] = await Promise.all([
    context.build.type !== "disabled"
      ? BUILD_TYPES[context.build.buildType].jobs(
          context as ComponentContextWithBuild,
        )
      : [],
    context.componentConfig.deploy !== false
      ? DEPLOY_TYPES[context.componentConfig.deploy.type].jobs(context)
      : [],
    createVerifyJobs(context),
  ]);

  const customJobs = getCustomJobs(context);

  return [...buildJobs, ...deployJobs, ...verifyJobs, ...customJobs];
};
