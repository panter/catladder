import type { StringOrBashExpression } from "../../../../bash";
import type { ComponentContext } from "../../../../types/context";
import type {
  DeployConfigCloudRunExecuteOnDeploy,
  DeployConfigCloudRunJob,
  DeployConfigCloudRunService,
} from "../../../types/googleCloudRun";
import { createArgsString } from "../../utils/createArgsString";
import { getCloudRunServiceOrJobArgsArg } from "../../utils/getJobOrServiceArgs";
import { getFullJobName } from "../../utils/jobName";
import { getCloudRunJobsWithNames } from "../cloudRunJobs";
import {
  gcloudRunCmd,
  getCloudRunDeployConfig,
  getCommonCloudRunArgs,
} from "../common";

type Execute = {
  jobName: StringOrBashExpression;
  config: DeployConfigCloudRunExecuteOnDeploy;
};
export const getOnDeployExecuteScript = (
  context: ComponentContext,
  when: DeployConfigCloudRunExecuteOnDeploy["when"],
) => {
  const executes = getExecutes(context);

  return executes
    .filter(({ config }) => config.when === when)
    .map((execute) => {
      return getJobRunScriptForExecute(context, execute);
    });
};

const getExecutes = (context: ComponentContext): Execute[] => {
  const deployConfig = getCloudRunDeployConfig(context);
  return [
    ...getLegacyExecutes(context),
    ...Object.entries(deployConfig.execute ?? {}).flatMap(([key, value]) => {
      if (!value || (value.when !== "schedule" && value.type !== "job")) {
        return [];
      }
      return [
        {
          jobName: key,
          config: value,
        } as Execute,
      ];
    }),
  ];
};

const getLegacyExecutes = (context: ComponentContext): Execute[] => {
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return jobsWithNames.flatMap(({ jobName, job }) => {
    if (
      !job.when ||
      !["preDeploy", "postDeploy", "preStop", "postStop"].includes(job.when)
    ) {
      return [];
    }
    return [
      {
        jobName,
        config: {
          job: jobName,
          type: "job",
          when: job.when,
          ...(job.when === "preDeploy" || job.when === "postDeploy"
            ? {
                waitForCompletion: job.waitForCompletion,
              }
            : {}),
        } as Execute["config"],
      },
    ];
  });
};

const getJobRunScriptForExecute = (
  context: ComponentContext,
  { jobName, config }: Execute,
) => {
  const commonArgs = getCommonCloudRunArgs(context);

  // always wait for completion for preStop and postStop jobs
  // since stop will delete the jobs afterwards, so they will fail
  const waitForCompletion = ["preStop", "postStop"].includes(config.when)
    ? true // always
    : "waitForCompletion" in config
      ? (config.waitForCompletion ?? false) // depends on config
      : false;

  const argString = createArgsString({
    ...commonArgs,
    wait: waitForCompletion === true ? true : undefined,
    args: getCloudRunServiceOrJobArgsArg(config.args),
  });
  const fullJobName = getFullJobName(context, jobName);
  return `${gcloudRunCmd()} jobs execute ${fullJobName.toString()} ${argString}`;
};
