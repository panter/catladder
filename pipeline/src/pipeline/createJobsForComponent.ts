import { isFunction } from "lodash";
import { BUILD_TYPES } from "../build";
import { createReportingJobs } from "../verify/reporting";
import { createContext } from "../context";
import { DEPLOY_TYPES } from "../deploy";
import type { Config, PipelineTrigger } from "../types/config";
import type { CommitInfo, Context } from "../types/context";
import type { CatladderJob } from "../types/jobs";
import { getBaseCommitInfo } from "./commitInfo/getCommitInfo";
import { getPackageManagerInfo } from "./packageManager";

const injectDefaultVarsInCustomJobs = (
  context: Context,
  jobs: CatladderJob[]
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
  const reportingJobs = createReportingJobs(context);

  const customJobs = getCustomJobs(context);
  return [...buildJobs, ...deployJobs, ...reportingJobs, ...customJobs];
};
export const createJobsForComponent = async (
  config: Config,
  componentName: string,
  env: string,
  trigger: PipelineTrigger
): Promise<Array<CatladderJob>> => {
  const commitInfo: CommitInfo = {
    ...(await getBaseCommitInfo()),
    trigger,
  };

  const packageManagerInfo = await getPackageManagerInfo(config, componentName);

  const context = await createContext(
    config,
    componentName,
    env,
    commitInfo,
    packageManagerInfo
  );
  return createRawJobs(context);
};
