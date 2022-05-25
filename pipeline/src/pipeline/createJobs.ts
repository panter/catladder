import { exec } from "child-process-promise";
import { isFunction, isObject } from "lodash";
import { BUILD_TYPES } from "../build";
import { createContext } from "../context";
import { DEPLOY_TYPES } from "../deploy";
import { PipelineJob, PipelineType } from "../types";
import { Config, PipelineTrigger } from "../types/config";
import { CommitInfo, Context } from "../types/context";
import { CatladderJob } from "../types/jobs";
import { notNil } from "../utils";
import { makeGitlabJob } from "./gitlab/makeGitlabJob";
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
  if (context.componentConfig.deploy === false) {
    return [];
  }
  const buildJobs =
    BUILD_TYPES[context.componentConfig.build.type].jobs(context);
  const deployJobs =
    DEPLOY_TYPES[context.componentConfig.deploy.type].jobs(context);

  const customJobs = getCustomJobs(context);
  return [...buildJobs, ...deployJobs, ...customJobs];
};
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
  allRawJobs: CatladderJob[]
) => {
  const referencedJob = allRawJobs.find((j) => j.name === referencedJobName);
  if (!referencedJob) {
    throw new Error("unknown job referenced: " + referencedJobName);
  }
  const envToSet = referencedJob.envMode !== "none" ? env : null;
  return getFullJobName(referencedJobName, componentName, envToSet);
};
// replaces references to other jobs with the full name
// the full name contains the componentname and the env name (if any)
const replaceReferences = (
  job: CatladderJob,
  componentName: string,
  env: string,
  allRawJobs: CatladderJob[]
): CatladderJob<string> => {
  const stage =
    job.envMode === "stagePerEnv" ? `${job.stage} ${env}` : job.stage;

  const needsFromNeeds: CatladderJob["needs"] = job.needs?.map((n) =>
    isObject(n)
      ? {
          job: getFullReferencedJobName(n.job, componentName, env, allRawJobs),
          artifacts: n.artifacts,
        }
      : getFullReferencedJobName(n, componentName, env, allRawJobs)
  );
  const needsFromOtherComponents: CatladderJob["needs"] =
    job.needsOtherComponent?.map((other) => ({
      artifacts: other.artifacts,
      job: getFullReferencedJobName(
        other.job,
        other.componentName,
        env,
        allRawJobs
      ),
    }));
  const needs = [
    ...(needsFromNeeds ?? []),
    ...(needsFromOtherComponents ?? []),
  ];
  return {
    ...job,
    stage,
    needs,
    environment: job.environment?.on_stop
      ? {
          ...job.environment,
          on_stop: getFullReferencedJobName(
            job.environment.on_stop,
            componentName,
            env,
            allRawJobs
          ),
        }
      : job.environment,
  };
};

// this can be removed once https://gitlab.com/gitlab-org/gitlab/-/issues/220758 is resolved
const addStageNeeds = (jobs: CatladderJob[]): CatladderJob[] => {
  // when a job defines needsStages, we add these as needs
  return jobs.map((job) => {
    if (!job.needsStages || job.needsStages.length === 0) {
      return job;
    }

    const neededJobs = jobs
      .map((j) => {
        const neededStage = job.needsStages?.find((s) => j.stage === s.stage);
        if (neededStage) {
          return {
            job: j.name,
            artifacts: neededStage.artifacts ?? false,
          };
        }
      })
      .filter(notNil);
    return {
      ...job,

      needs: [...(job.needs ?? []), ...neededJobs],
    };
  });
};

export const createJobs = async <T extends PipelineType>(
  type: T,
  envs: string[],
  config: Config,
  componentName: string,
  trigger: PipelineTrigger
): Promise<Record<string, PipelineJob<T>>> => {
  const commitInfo: CommitInfo = {
    refName: process.env.CI_COMMIT_REF_NAME ?? "unknown",
    reviewSlug: process.env.CI_MERGE_REQUEST_IID
      ? `mr${process.env.CI_MERGE_REQUEST_IID}`
      : "unknown",
    buildTime: new Date().toISOString(),
    buildId: await exec("git describe --tags || git rev-parse HEAD").then((s) =>
      s.stdout.trim()
    ),
    trigger,
  };

  const packageManagerInfo = await getPackageManagerInfo(config, componentName);

  return envs.reduce((acc, env) => {
    const context = createContext(
      config,
      componentName,
      env,
      commitInfo,
      packageManagerInfo
    );
    const jobs = addStageNeeds(createRawJobs(context));

    const result = {
      ...acc,
      ...jobs.reduce<Record<string, PipelineJob<T>>>((acc, job) => {
        const jobWithResolvedReferences = replaceReferences(
          job,
          componentName,
          env,
          jobs
        );
        const jobName = getFullJobName(
          job.name,
          componentName,
          job.envMode !== "none" ? env : undefined
        );
        if (type === "gitlab") {
          return {
            ...acc,
            [jobName]: makeGitlabJob(
              jobWithResolvedReferences
            ) as PipelineJob<T>,
          };
        }
        throw new Error("not supported");
      }, {}),
    };
    return result;
  }, {});
};
