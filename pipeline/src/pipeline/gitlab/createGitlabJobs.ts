import { isObject } from "lodash";
import { BASE_RETRY } from "../../defaults";
import type { GitlabJobDef } from "../../types";
import type { CatladderJob, CatladderJobNeed } from "../../types/jobs";
import type { AllCatladderJobs } from "../createAllJobs";

type AllGitlabJobs = Record<string, GitlabJobDef>;

const removeUndefined = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as T;
const getFullJobName = (
  name: string,
  componentName: string,
  env?: string | null
) => {
  if (env) {
    return `${componentName} ${name} | ${env} `;
  }
  return `${componentName} ${name}`;
};

const getFullReferencedJobName = (
  referencedJobName: string,
  componentName: string,
  env: string,
  allJobs: AllCatladderJobs
) => {
  const referencedJob = allJobs[componentName]?.[env]?.find(
    (j) => j.name === referencedJobName
  );
  if (!referencedJob) {
    throw new Error(
      `unknown job referenced: '${referencedJobName}' from '${env}:${componentName}'`
    );
  }
  const envToSet = referencedJob.envMode !== "none" ? env : null;
  return getFullJobName(referencedJobName, componentName, envToSet);
};

const getJobName = (need: CatladderJobNeed) =>
  isObject(need) ? need.job : need;

export const makeGitlabJob = (
  componentName: string,
  env: string,
  {
    envMode,
    needsStages,
    needsOtherComponent,
    name,
    needs,
    jobTags,
    ...job
  }: CatladderJob<string>,
  allJobs: AllCatladderJobs
): [fullName: string, job: GitlabJobDef] => {
  const stage = envMode === "stagePerEnv" ? `${job.stage} ${env}` : job.stage;

  const needsFromStages: CatladderJob["needs"] = needsStages?.flatMap((n) => {
    const referencedComponentName = componentName;
    const allJobNamesFromThatStage =
      allJobs[referencedComponentName]?.[env]
        ?.filter((j) => j.stage === n.stage)
        ?.map((j) => j.name) ?? [];

    return allJobNamesFromThatStage.map((job) => ({
      job,
      artifacts: n.artifacts ?? false,
      componentName: referencedComponentName,
    }));
  });
  const cleanedNeeds: CatladderJob["needs"] = [
    ...(needsFromStages ?? []),
    ...(needs ?? []),
    // pull in legacy needs from other component, which is now identical to needs
    ...(needsOtherComponent ?? []),
  ];

  const gitlabNeeds: GitlabJobDef["needs"] = cleanedNeeds
    ?.map((n) =>
      isObject(n)
        ? {
            job: getFullReferencedJobName(
              n.job,
              n.componentName ?? componentName,
              env,
              allJobs
            ),
            artifacts: n.artifacts,
          }
        : getFullReferencedJobName(n, componentName, env, allJobs)
    ) // sort in a predictable manner for snapshot tests
    .sort((a, b) => getJobName(a).localeCompare(getJobName(b)));

  const deduplicatedGitlabNeeds: GitlabJobDef["needs"] = [
    ...new Map(gitlabNeeds.map((n) => [isObject(n) ? n.job : n, n])).values(),
  ];

  const fullJobName = getFullJobName(
    name,
    componentName,
    envMode !== "none" ? env : undefined
  );

  const gitlabJob: GitlabJobDef = removeUndefined({
    ...job,
    tags: jobTags,
    stage,
    environment: job.environment?.on_stop
      ? {
          ...job.environment,
          on_stop: getFullReferencedJobName(
            job.environment.on_stop,
            componentName,
            env,
            allJobs
          ),
        }
      : job.environment,
    // sort in a predictable manner for snapshot tests
    needs: deduplicatedGitlabNeeds,
    retry: BASE_RETRY,
    interruptible: true,
  });

  return [fullJobName, gitlabJob];
};

export const createGitlabJobs = async (
  allJobs: AllCatladderJobs
): Promise<AllGitlabJobs> => {
  return Object.keys(allJobs).reduce((accForComponents, componentName) => {
    const componentJobs = allJobs[componentName];
    return {
      ...accForComponents,
      ...Object.keys(componentJobs).reduce((accForEnvs, env) => {
        const jobs = componentJobs[env];

        return {
          ...accForEnvs,
          ...jobs.reduce((accForJobs, job) => {
            const [fullJobName, gitlabJob] = makeGitlabJob(
              componentName,
              env,
              job,
              allJobs
            );
            return {
              ...accForJobs,
              [fullJobName]: gitlabJob,
            };
          }, {} as AllGitlabJobs),
        };
      }, {} as AllGitlabJobs),
    };
  }, {} as AllGitlabJobs);
};
