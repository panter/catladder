import { BUILD_TYPES } from "../build";
import type { CreateComponentContextContext } from "../context";
import { createComponentContext } from "../context";
import { DEPLOY_TYPES } from "../deploy";
import type {
  CatladderJobWithContext,
  ComponentContext,
  Context,
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
const createRawJobs = (context: Context): CatladderJob[] => {
  const buildJobs = BUILD_TYPES[context.build.config.type].jobs(context);
  const deployJobs = context.deploy?.config
    ? DEPLOY_TYPES[context.deploy?.config.type].jobs(context)
    : [];

  const customJobs = getCustomJobs(context);
  return [...buildJobs, ...deployJobs, ...customJobs];
};

export const createJobsForComponent = async (
  contextContext: Omit<CreateComponentContextContext, "packageManagerInfo">,
): Promise<Array<CatladderJobWithContext>> => {
  const context = await createComponentContext(contextContext);
  return createRawJobs(context).map((job) => ({ ...job, context }));
};
