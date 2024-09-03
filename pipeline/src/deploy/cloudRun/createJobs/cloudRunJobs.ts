import type { ComponentContext } from "../../../types/context";

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
import { createVolumeConfig } from "./volumes";
import type {
  BashExpression,
  StringOrBashExpression,
} from "../../../bash/BashExpression";
import { ENV_VARS_FILENAME } from "./constants";
import { notNil } from "../../../utils";

const getJobRunScriptForJob = (
  context: ComponentContext,
  jobName: StringOrBashExpression,
  wait: boolean,
) => {
  const commonArgs = getCommonCloudRunArgs(context);

  const commonArgsString = createArgsString(commonArgs);
  return `${gcloudRunCmd()} jobs execute ${jobName.toString()} ${commonArgsString}${
    wait ? " --wait" : ""
  }`;
};

export const getDeleteSchedulesScripts = (context: ComponentContext) => {
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

export const getDeleteJobsScripts = (context: ComponentContext) => {
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
  context: ComponentContext,
  when: DeployConfigCloudRunJob["when"],
) => {
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return jobsWithNames
    .filter(({ job }) => job.when === when)
    .map(({ jobName, job }) => {
      // always wait for completion for preStop and postStop jobs
      // since stop will delete the jobs afterwards, so they will fail
      const waitForCompletion = ["preStop", "postStop"].includes(when)
        ? true
        : "waitForCompletion" in job
          ? (job.waitForCompletion ?? false)
          : false;
      return getJobRunScriptForJob(context, jobName, waitForCompletion);
    });
};

export const getJobCreateScripts = (context: ComponentContext): string[] =>
  getCloudRunJobsWithNames(context).map(
    (
      {
        job: {
          command,
          image,
          cpu,
          memory = "512Mi",
          timeout = "10m",
          parallelism = 1,
          volumes,
        },
        jobName,
      },
      jobIndex,
    ): string => {
      const commandArray = Array.isArray(command)
        ? command
        : command.split(" ");

      const {
        image: commonImage,
        project,
        region,
        ...deployArgs
      } = getCommonDeployArgs(context);
      const commonDeployArgsString = createArgsString(
        {
          command: `"${commandArray.join(",")}"`,
          labels: `"${makeLabelString(getLabels(context))},cloud-run-job-name=$current_job_name"`,
          image: `"${image ?? commonImage}"`,
          project,
          region,
          cpu,
          memory,
          parallelism,
          "task-timeout": timeout,
          "env-vars-file": ENV_VARS_FILENAME,
          "max-retries": 0,
          ...deployArgs,
        },
        ...createVolumeConfig(volumes, "job"),
      );

      return [
        jobIndex === 0
          ? `exist_job_names="$(\n  ${gcloudRunCmd()} jobs list --filter='metadata.name ~ ${context.env}.*${context.name}' --format='value(name)' --limit=999 --project='${project}' --region='${region}'\n)"`
          : null,
        `current_job_name="${jobName}"`,
        'if grep "$current_job_name" <<<"$exist_job_names" >/dev/null; then',
        `  ${gcloudRunCmd()} jobs update "$current_job_name" ${commonDeployArgsString}`,
        "else",
        `  ${gcloudRunCmd()} jobs create "$current_job_name" ${commonDeployArgsString}`,
        "fi",
      ]
        .filter(notNil)
        .join("\n");
    },
  );

export const getCreateScheduleScripts = (
  context: ComponentContext,
): string[] => {
  const jobsWithSchedule = getCloudRunJobsWithSchedule(context);
  const { region: location, projectId: project } =
    getCloudRunDeployConfig(context);

  const uriBase = `https://${location}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${project}/jobs`;
  const gcloudArgs = {
    project,
    location,
    uri: `"$current_job_uri"`,
    "http-method": "POST",
    "oauth-service-account-email": `"$GCLOUD_PROJECT_NUMBER-compute@developer.gserviceaccount.com"`,
  };

  return jobsWithSchedule.map(
    (
      { job: { maxRetryAttempts, schedule }, jobName, schedulerName },
      jobIndex,
    ): string => {
      const argsString = createArgsString({
        ...gcloudArgs,
        schedule: `"${schedule}"`,
        "max-retry-attempts": maxRetryAttempts ?? 0,
      });
      return [
        jobIndex === 0
          ? `exist_scheduler_names="$(\n  ${gcloudSchedulerCmd()} jobs list --filter='httpTarget.uri ~ ${context.env}.*${context.name}' --format='value(name)' --limit=999 --location='${location}' --project='${project}'\n)"`
          : null,
        `current_job_uri="${uriBase}/${jobName}:run"`,
        `current_scheduler_name="${schedulerName}"`,
        `if grep "$current_scheduler_name" <<<"$exist_scheduler_names" >/dev/null; then`,
        `  ${gcloudSchedulerCmd()} jobs update http "$current_scheduler_name" ${argsString}`,
        `else`,
        `  ${gcloudSchedulerCmd()} jobs create http "$current_scheduler_name" ${argsString}`,
        `fi`,
      ]
        .filter(notNil)
        .join("\n");
    },
  );
};

const getCloudRunJobsWithSchedule = (context: ComponentContext) => {
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return jobsWithNames
    .filter(
      (
        entry,
      ): entry is {
        jobName: BashExpression;
        job: DeployConfigCloudRunJobWithSchedule;
        jobKey: string;
      } => entry.job.when === "schedule",
    )
    .map(({ job, jobName, jobKey }) => ({
      job,
      jobName,
      jobKey,
      schedulerName: jobName.concat("-scheduler"),
    }));
};

const getCloudRunJobsWithNames = (context: ComponentContext) => {
  const deployConfig = getCloudRunDeployConfig(context);

  const getFullJobName = (name: string) =>
    getCloudRunJobName(context.environment.fullName, name);

  const jobsWithNames = Object.entries(deployConfig.jobs ?? {})
    // filter out disabled jobs
    .filter((entry): entry is [string, DeployConfigCloudRunJob] =>
      Boolean(entry[1]),
    )
    .map(([jobKey, job]) => ({
      jobName: getFullJobName(jobKey),
      job,
      jobKey,
    }));
  return jobsWithNames;
};
