import type { Context } from "../../../types/context";
import { allowFailureInScripts } from "../../../utils/gitlab";

import type {
  DeployConfigCloudRunJob,
  DeployConfigCloudRunJobWithSchedule,
} from "../../types/googleCloudRun";
import { createArgsString } from "../utils/createArgsString";
import { getCloudRunJobName } from "../utils/jobName";
import {
  gcloudRunCmd,
  gcloudSchedulerCmd,
  getCloudRunDeployConfig,
  getCommonCloudRunArgs,
  getCommonDeployArgs,
  makeLabelString,
} from "./common";
import { getLabels } from "../../../context/getLabels";

const getJobRunScriptForJob = (
  context: Context,
  jobName: string,
  wait: boolean
) => {
  const commonArgs = getCommonCloudRunArgs(context);

  const commonArgsString = createArgsString(commonArgs);
  return `${gcloudRunCmd()} jobs execute ${jobName} ${commonArgsString}${
    wait ? " --wait" : ""
  }`;
};

export const getDeleteSchedulesScripts = (context: Context) => {
  const deployConfig = getCloudRunDeployConfig(context);
  const jobsWithSchedule = getCloudRunJobsWithSchedule(context);
  const argsString = createArgsString({
    project: deployConfig.projectId,
    location: deployConfig.region,
  });
  return jobsWithSchedule
    .map(({ schedulerName }) => {
      return [
        `${gcloudSchedulerCmd()} jobs delete ${schedulerName} ${argsString}`,
      ];
    })
    .flat();
};

export const getDeleteJobsScripts = (context: Context) => {
  const commonArgs = getCommonCloudRunArgs(context);
  const commonArgsString = createArgsString(commonArgs);
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return jobsWithNames.flatMap(({ jobName }) => [
    // first delete all job executions. Otherwise delete might fail if one of those is still running
    `${gcloudRunCmd()} jobs executions list ${commonArgsString} --job ${jobName} --format="value(name)" | xargs -I {} ${gcloudRunCmd()} jobs executions delete {}  --quiet ${commonArgsString}`,
    `${gcloudRunCmd()} jobs delete ${jobName} ${commonArgsString}`,
  ]);
};

export const getJobRunScripts = (
  context: Context,
  when: DeployConfigCloudRunJob["when"]
) => {
  const jobsWithNames = getCloudRunJobsWithNames(context);
  return jobsWithNames
    .filter(({ job }) => job.when === when)
    .map(({ jobName }) =>
      getJobRunScriptForJob(
        context,
        jobName,
        // wait for completin on stop jobs, since stop will delete the jobs afterwards, so they will fail
        ["preStop", "postStop"].includes(when)
      )
    );
};

export const getJobCreateScripts = (context: Context) => {
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return jobsWithNames
    .map(({ job, jobName }) => getJobCreateScriptsForJob(context, jobName, job))
    .flat();
};

const getJobCreateScriptsForJob = (
  context: Context,
  jobName: string,
  job: DeployConfigCloudRunJob
) => {
  const commonDeployArgs = getCommonDeployArgs(context);

  // we cannot upsert a job, so we have to create it and catch the error and then update
  const commandArray = Array.isArray(job.command)
    ? job.command
    : job.command.split(" ");

  const commonDeployArgsString = createArgsString({
    command: '"' + commandArray.join(",") + '"',
    ...commonDeployArgs,
    labels: makeLabelString({
      ...getLabels(context),
      "cloud-run-job-name": jobName,
    }),
    image: job.image || commonDeployArgs.image,
    memory: job.memory || "512Mi",
    "task-timeout": job.timeout || "10m",
    parallelism: job.parallelism || 1,
    "env-vars-file": "____envvars.yaml",
    "max-retry-attempts": 0,
  });

  const argsString = `${jobName} ${commonDeployArgsString}`;
  return [
    ...allowFailureInScripts([`${gcloudRunCmd()} jobs create ${argsString}`]),
    `${gcloudRunCmd()} jobs update ${argsString}`,
  ];
};

export const getCreateScheduleScripts = (context: Context) => {
  const jobsWithSchedule = getCloudRunJobsWithSchedule(context);
  const deployConfig = getCloudRunDeployConfig(context);

  return jobsWithSchedule
    .map(({ job, jobName, schedulerName }) => {
      const argsString = createArgsString({
        project: deployConfig.projectId,
        location: deployConfig.region,
        schedule: `"${job.schedule}"`,
        "max-retry-attempts": job.maxRetryAttempts ?? 0,

        uri: `"https://${deployConfig.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${deployConfig.projectId}/jobs/${jobName}:run"`,
        "http-method": "POST",
        "oauth-service-account-email":
          "$GCLOUD_PROJECT_NUMBER-compute@developer.gserviceaccount.com",
      });
      const commonArgs = `http ${schedulerName} ${argsString}`;
      return [
        ...allowFailureInScripts([
          `${gcloudSchedulerCmd()} jobs create ${commonArgs}`,
        ]),
        `${gcloudSchedulerCmd()} jobs update ${commonArgs}`,
      ];
    })
    .flat();
};

const getCloudRunJobsWithSchedule = (context: Context) => {
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return jobsWithNames
    .filter(
      (
        entry
      ): entry is {
        jobName: string;
        job: DeployConfigCloudRunJobWithSchedule;
      } => entry.job.when === "schedule"
    )
    .map(({ job, jobName }) => ({
      job,
      jobName,
      schedulerName: jobName + "-scheduler",
    }));
};

const getCloudRunJobsWithNames = (context: Context) => {
  const deployConfig = getCloudRunDeployConfig(context);

  const getFullJobName = (name: string) =>
    getCloudRunJobName(context.environment.fullName, name);

  const jobsWithNames = Object.entries(deployConfig.jobs ?? {})
    // filter out disabled jobs
    .filter((entry): entry is [string, DeployConfigCloudRunJob] =>
      Boolean(entry[1])
    )
    .map(([name, job]) => ({
      jobName: getFullJobName(name),
      job,
    }));
  return jobsWithNames;
};
