import { bashEscape } from "../../../../bash";
import type {
  BashExpression,
  StringOrBashExpression,
} from "../../../../bash/BashExpression";
import type { ComponentContext } from "../../../../types/context";
import { notNil } from "../../../../utils";
import type {
  DeployConfigCloudRunExecuteWithSchedule,
  DeployConfigCloudRunJobWithSchedule,
} from "../../../types";
import { getCloudRunJobExecuteUrl } from "../../utils/cloudRunExecutionUrl";
import { createArgsString } from "../../utils/createArgsString";
import { getFullSchedulerName } from "../../utils/jobName";
import { getCloudRunJobsWithNames } from "../cloudRunJobs";
import { gcloudSchedulerCmd, getCloudRunDeployConfig } from "../common";

export const getDeleteSchedulesScript = (context: ComponentContext) => {
  const deployConfig = getCloudRunDeployConfig(context);
  const schedules = getSchedules(context);
  const argsString = createArgsString({
    project: deployConfig.projectId,
    location: deployConfig.region,
  });

  return schedules
    .map(({ fullName }) => {
      return [`${gcloudSchedulerCmd()} jobs delete ${fullName} ${argsString}`];
    })
    .flat();
};

export const getCreateScheduleScript = (
  context: ComponentContext,
): string[] => {
  const schedules = getSchedules(context);
  const { region: location, projectId: project } =
    getCloudRunDeployConfig(context);

  return schedules.map(({ fullName, config }, jobIndex): string => {
    const { uri, ...args } = getSchedulerArgs(config, context);

    const argsString = createArgsString({
      project,
      location,
      uri: `"$current_job_uri"`,
      ...args,

      schedule: `"${config.schedule}"`,
      "max-retry-attempts": config.maxRetryAttempts ?? 0,
    });
    return [
      jobIndex === 0
        ? `exist_scheduler_names="$(\n  ${gcloudSchedulerCmd()} jobs list --filter='httpTarget.uri ~ ${context.env}.*${context.name}' --format='value(name)' --limit=999 --location='${location}' --project='${project}'\n)"`
        : null,
      `current_job_uri="${uri}"`,
      `current_scheduler_name="${fullName}"`,
      `if echo "$exist_scheduler_names" | grep -Fx "$current_scheduler_name" >/dev/null; then`,
      `  ${gcloudSchedulerCmd()} jobs update http "$current_scheduler_name" ${argsString}`,
      `else`,
      `  ${gcloudSchedulerCmd()} jobs create http "$current_scheduler_name" ${argsString}`,
      `fi`,
    ]
      .filter(notNil)
      .join("\n");
  });
};

const getSchedulerArgs = (
  scheduler: DeployConfigCloudRunExecuteWithSchedule,
  context: ComponentContext,
): {
  uri: string;
  "http-method"?: string;
  "message-body"?: string;
  "oauth-service-account-email"?: string;
  "oidc-service-account-email"?: string;
} => {
  if (scheduler.type === "job") {
    const { projectId, region } = getCloudRunDeployConfig(context);
    const body =
      scheduler.args !== undefined
        ? {
            overrides: {
              containerOverrides: [
                scheduler.args?.length > 0
                  ? {
                      args: scheduler.args,
                    }
                  : {
                      args: [],
                      clearArgs: true, // not sure why this is neeeded, but it is
                    },
              ],
            },
          }
        : null;
    return {
      uri: getCloudRunJobExecuteUrl(scheduler.job, {
        appFullName: context.environment.fullName,
        projectId,
        region,
      }),
      "message-body": body
        ? '"' + bashEscape(JSON.stringify(body)) + '"'
        : undefined,
      "http-method": "POST",
      "oauth-service-account-email": `"$GCLOUD_PROJECT_NUMBER-compute@developer.gserviceaccount.com"`,
    };
  }
  if (scheduler.type === "http") {
    return {
      uri: scheduler.url,
      "message-body": scheduler.body,
      "http-method": scheduler.method,
      "oidc-service-account-email": `"$GCLOUD_PROJECT_NUMBER-compute@developer.gserviceaccount.com"`,
    };
  }
  throw new Error(`Unknown scheduler type: ${(scheduler as any).type}`);
};

const getSchedules = (
  context: ComponentContext,
): {
  name: string;
  fullName: StringOrBashExpression;
  config: DeployConfigCloudRunExecuteWithSchedule;
}[] => {
  const legacyScheduleJobs = getLegacyJobSchedules(context);
  const schedules = getScheduledExecutes(context);

  return Object.entries({ ...legacyScheduleJobs, ...schedules }).map(
    ([name, config]) => ({
      name,
      fullName: getFullSchedulerName(context, name),
      config,
    }),
  );
};

const getLegacyJobSchedules = (
  context: ComponentContext,
): Record<string, DeployConfigCloudRunExecuteWithSchedule> => {
  const jobsWithNames = getCloudRunJobsWithNames(context);

  return Object.fromEntries(
    jobsWithNames
      .filter(
        (
          entry,
        ): entry is {
          fullJobName: BashExpression;
          job: DeployConfigCloudRunJobWithSchedule;
          jobName: string;
        } => entry.job.when === "schedule",
      )
      .map(({ job: { maxRetryAttempts, schedule }, jobName }) => {
        const schedulerName = jobName.concat("-scheduler");
        return [
          schedulerName,
          {
            type: "job",
            job: jobName,
            maxRetryAttempts,
            schedule,
            when: "schedule",
          },
        ];
      }),
  );
};

const getScheduledExecutes = (
  context: ComponentContext,
): Record<string, DeployConfigCloudRunExecuteWithSchedule> => {
  const deployConfig = getCloudRunDeployConfig(context);

  return Object.fromEntries(
    Object.entries(deployConfig.execute ?? {}).flatMap(([key, value]) => {
      if (!value || value.when !== "schedule") {
        return [];
      }
      return [[key, value]];
    }),
  );
};
