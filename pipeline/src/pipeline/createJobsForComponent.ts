import { isFunction } from "lodash";
import { BUILD_TYPES } from "../build";
import type { CreateContextContext } from "../context";
import { createContext } from "../context";
import { DEPLOY_TYPES } from "../deploy";
import type { CatladderJobWithContext, Context } from "../types/context";
import type { CatladderJob } from "../types/jobs";
import { getPackageManagerInfo } from "./packageManager";

const injectDefaultVarsInCustomJobs = (
  context: Context,
  jobs: CatladderJob[],
) =>
  jobs.map(({ variables, ...job }) => ({
    variables: {
      ...(context.environment.envVars ?? {}),
      ...(variables ?? {}),
    },
    ...job,
  }));
const getCustomJobs = (context: Context) => {
  if (!context.componentConfig.customJobs) {
    return [];
  }
  const rawJobs = isFunction(context.componentConfig.customJobs)
    ? context.componentConfig.customJobs(context)
    : context.componentConfig.customJobs;
  return injectDefaultVarsInCustomJobs(context, rawJobs);
};
const createRawJobs = (context: Context): CatladderJob[] => {
  const buildJobs =
    BUILD_TYPES[context.componentConfig.build.type].jobs(context);
  const deployJobs =
    context.componentConfig.deploy !== false
      ? DEPLOY_TYPES[context.componentConfig.deploy.type].jobs(context)
      : [];

  const customJobs = getCustomJobs(context);
  return [...buildJobs, ...deployJobs, ...customJobs];
};

export const createJobsForComponent = async (
  contextContext: Omit<CreateContextContext, "packageManagerInfo">,
): Promise<Array<CatladderJobWithContext>> => {
  const packageManagerInfo = await getPackageManagerInfo(
    contextContext.config,
    contextContext.componentName,
  );

  const context = await createContext({
    ...contextContext,
    packageManagerInfo,
  });
  return createRawJobs(context).map((job) => ({ ...job, context }));
};
