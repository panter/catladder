import type { ComponentContext } from "../../../types/context";

import { getLabels } from "../../../context/getLabels";
import { notNil } from "../../../utils";
import type { DeployConfigCloudRunJob } from "../../types/googleCloudRun";
import { createArgsString } from "../utils/createArgsString";
import { getFullJobName } from "../utils/jobName";
import {
  gcloudRunCmd,
  getCloudRunDeployConfig,
  getCommonCloudRunArgs,
  getCommonDeployArgs,
  makeLabelString,
} from "./common";
import { ENV_VARS_FILENAME } from "./constants";
import { createVolumeConfig } from "./volumes";
import { getCloudRunJobArgsArg } from "./execute/onDeploy";

export const getDeleteJobsScripts = (context: ComponentContext) => {
  const commonArgs = getCommonCloudRunArgs(context);
  const commonArgsString = createArgsString(commonArgs);
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return jobsWithNames.flatMap(({ fullJobName }) => [
    // first delete all job executions. Otherwise delete might fail if one of those is still running
    `${gcloudRunCmd()} jobs executions list ${commonArgsString} --job ${fullJobName} --format="value(name)" | xargs -I {} ${gcloudRunCmd()} jobs executions delete {}  --quiet ${commonArgsString}`,
    `${gcloudRunCmd()} jobs delete ${fullJobName} ${commonArgsString}`,
  ]);
};

export const getJobCreateScripts = (context: ComponentContext): string[] =>
  getCloudRunJobsWithNames(context).map(
    ({ job, fullJobName }, jobIndex): string => {
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
          args: getCloudRunJobArgsArg(job.args),
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
        `current_job_name="${fullJobName}"`,
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

export const getCloudRunJobsWithNames = (context: ComponentContext) => {
  const deployConfig = getCloudRunDeployConfig(context);

  const jobsWithNames = Object.entries(deployConfig.jobs ?? {})
    // filter out disabled jobs
    .filter((entry): entry is [string, DeployConfigCloudRunJob] =>
      Boolean(entry[1]),
    )
    .map(([jobName, job]) => ({
      fullJobName: getFullJobName(context, jobName),
      job,
      jobName,
    }));
  return jobsWithNames;
};
