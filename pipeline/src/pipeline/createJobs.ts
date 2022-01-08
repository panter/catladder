import { isObject } from "lodash";
import { BUILD_TYPES } from "../build";
import { createContext } from "../context";
import { DEPLOY_TYPES } from "../deploy";
import { Config, PipelineTrigger } from "../types/config";
import { Context, CommitInfo } from "../types/context";
import { GitlabJob, GitlabJobDef, GitlabJobs } from "../types/gitlab-types";

const createRawJobs = (context: Context): GitlabJobs => {
  if (context.componentConfig.deploy === false) {
    return [];
  }
  const buildJobs =
    BUILD_TYPES[context.componentConfig.build.type].jobs(context);
  const deployJobs =
    DEPLOY_TYPES[context.componentConfig.deploy.type].jobs(context);

  return [...buildJobs, ...deployJobs];
};
const getFullJobName = (
  name: string,
  componentName: string,
  env?: string | null
) => {
  if (env) {
    return `${env} ${componentName} ${name}`;
  }
  return `${componentName} ${name}`;
};

const getFullReferencedJobName = (
  referencedJobName: string,
  componentName: string,
  env: string,
  allRawJobs: GitlabJobs
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
  job: GitlabJob,
  componentName: string,
  env: string,
  allRawJobs: GitlabJobs
): GitlabJobDef => {
  const def = job.job;
  const stage =
    job.envMode === "stagePerEnv" ? `${def.stage} ${env}` : def.stage;
  return {
    ...def,
    stage,
    needs: def.needs?.map((n) =>
      isObject(n)
        ? {
            job: getFullReferencedJobName(
              n.job,
              componentName,
              env,
              allRawJobs
            ),
            artifacts: n.artifacts,
          }
        : getFullReferencedJobName(n, componentName, env, allRawJobs)
    ),
    environment: def.environment?.on_stop
      ? {
          ...def.environment,
          on_stop: getFullReferencedJobName(
            def.environment.on_stop,
            componentName,
            env,
            allRawJobs
          ),
        }
      : def.environment,
    dependencies: def.dependencies?.map((n) =>
      getFullReferencedJobName(n, componentName, env, allRawJobs)
    ),
  };
};
function notNil<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

// this can be removed once https://gitlab.com/gitlab-org/gitlab/-/issues/220758 is resolved
const addStageNeeds = (jobs: GitlabJobs): GitlabJobs => {
  // when a job defines needsStages, we add these as needs
  return jobs.map((job) => {
    if (!job.needsStages || job.needsStages.length === 0) {
      return job;
    }

    const neededJobs = jobs
      .map((j) => {
        const neededStage = job.needsStages?.find(
          (s) => j.job.stage === s.stage
        );
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
      job: {
        ...job.job,
        needs: [...(job.job.needs ?? []), ...neededJobs],
      },
    };
  });
};
export const createJobs = (
  envs: string[],
  config: Config,
  componentName: string,
  trigger: PipelineTrigger
): Record<string, GitlabJobDef> => {
  const commitInfo: CommitInfo = {
    refName: process.env.CI_COMMIT_REF_NAME ?? "unknown",
    refSlug: process.env.CI_COMMIT_REF_SLUG ?? "unknown",
    trigger,
  };

  return envs.reduce((acc, env) => {
    const context = createContext(config, componentName, env, commitInfo);
    const jobs = addStageNeeds(createRawJobs(context));

    return {
      ...acc,
      ...jobs.reduce((acc, job) => {
        return {
          ...acc,
          [getFullJobName(
            job.name,
            componentName,
            job.envMode !== "none" ? env : undefined
          )]: replaceReferences(job, componentName, env, jobs),
        };
      }, {}),
    };
  }, {});
};
