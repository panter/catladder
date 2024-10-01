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
  const schedules = getSchedules(context);
  const argsString = createArgsString({
    project: deployConfig.projectId,
    location: deployConfig.region,
  });
  return schedules
    .map(({ name }) => {
      return [`${gcloudSchedulerCmd()} jobs delete ${name} ${argsString}`];
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
    ({ job, jobName }, jobIndex): string => {
      const commandArray = Array.isArray(job.command)
        ? job.command
        : job.command.split(" ");

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
          image: `"${job.image ?? commonImage}"`,
          project,
          region,
          cpu: job.cpu,
          memory: job.memory ?? "512Mi",
          parallelism: job.parallelism ?? 1,

          "task-timeout": job.timeout ?? "10m",
          "env-vars-file": ENV_VARS_FILENAME,
          "max-retries": 0,

          ...deployArgs,

          // network
          "vpc-connector": job?.vpcConnector,
          "vpc-egress": job?.vpcEgress,
          network: job?.network,
          subnet: job?.subnet,
        },
        ...createVolumeConfig(job.volumes, "job"),
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
  const schedules = getSchedules(context);
  const { region: location, projectId: project } =
    getCloudRunDeployConfig(context);

  return schedules.map((scheduler, jobIndex): string => {
    const uri = getSchedulerUrl(scheduler, context);

    const argsString = createArgsString({
      project,
      location,
      uri: `"$current_job_uri"`,
      "http-method": "POST",
      "oauth-service-account-email": `"$GCLOUD_PROJECT_NUMBER-compute@developer.gserviceaccount.com"`,
      schedule: `"${scheduler.schedule}"`,
      "max-retry-attempts": scheduler.maxRetryAttempts ?? 0,
    });
    return [
      jobIndex === 0
        ? `exist_scheduler_names="$(\n  ${gcloudSchedulerCmd()} jobs list --filter='httpTarget.uri ~ ${context.env}.*${context.name}' --format='value(name)' --limit=999 --location='${location}' --project='${project}'\n)"`
        : null,
      `current_job_uri="${uri}"`,
      `current_scheduler_name="${scheduler.name}"`,
      `if grep "$current_scheduler_name" <<<"$exist_scheduler_names" >/dev/null; then`,
      `  ${gcloudSchedulerCmd()} jobs update http "$current_scheduler_name" ${argsString}`,
      `else`,
      `  ${gcloudSchedulerCmd()} jobs create http "$current_scheduler_name" ${argsString}`,
      `fi`,
    ]
      .filter(notNil)
      .join("\n");
  });
};

type Scheduler = {
  name: StringOrBashExpression;
  maxRetryAttempts?: number;
  schedule: string;
} & {
  type: "cloudRunJob";
  jobName: StringOrBashExpression;
};

const getSchedulerUrl = (scheduler: Scheduler, context: ComponentContext) => {
  if (scheduler.type === "cloudRunJob") {
    const { region: location, projectId: project } =
      getCloudRunDeployConfig(context);

    const uriBase = `https://${location}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${project}/jobs`;

    return `${uriBase}/${scheduler.jobName}:run`;
  }

  throw new Error(`Unknown scheduler type: ${scheduler.type}`);
};

const getSchedules = (context: ComponentContext): Scheduler[] => {
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
    .map(({ job: { maxRetryAttempts, schedule }, jobName }) => {
      const schedulerName = jobName.concat("-scheduler");
      return {
        name: schedulerName,
        maxRetryAttempts,
        schedule,
        type: "cloudRunJob",
        jobName,
      };
    });
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
