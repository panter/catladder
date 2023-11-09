import { dump } from "js-yaml";
import { merge, omit } from "lodash";
import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from ".";
import { getDockerJobBaseProps } from "../../build/docker";
import { getLabels } from "../../context/getLabels";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { allowFailureInScripts, collapseableSection } from "../../utils/gitlab";
import { createDeployementJobs } from "../base";
import {
  getDependencyTrackDeleteScript,
  getDependencyTrackUploadScript,
} from "../sbom";
import type {
  DeployConfigCloudRun,
  DeployConfigCloudRunJob,
  DeployConfigCloudRunJobWithSchedule,
  DeployConfigCloudRunService,
} from "../types";
import { isOfDeployType } from "../types";
import { createArgsString } from "./utils/createArgsString";
import {
  getDatabaseCreateScript,
  getDatabaseDeleteScript,
} from "./utils/database";
import { gcloudServiceAccountLoginCommands } from "./utils/gcloudServiceAccountLoginCommands";
import { getCloudRunJobName } from "./utils/jobName";
import { getArtifactsRegistryImage } from "./artifactsRegistry";
import { getServiceName } from "./utils/getServiceName";
import { getRemoveOldRevisionsAndImagesCommand } from "./cleanup";

const setGoogleProjectNumberScript = (deployConfig: DeployConfigCloudRun) => [
  `export GCLOUD_PROJECT_NUMBER=$(gcloud projects describe ${deployConfig.projectId} --format="value(projectNumber)")`,
  `echo "GCLOUD_PROJECT_NUMBER: $GCLOUD_PROJECT_NUMBER"`,
];

const makeLabelString = (obj: Record<string, unknown>) =>
  Object.entries(obj)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");

export const createGoogleCloudRunDeployJobs = (
  context: Context
): CatladderJob[] => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  const allEnvVars = omit(
    context.environment.envVars,
    GCLOUD_DEPLOY_CREDENTIALS_KEY
  );

  const commonArgs = {
    project: deployConfig.projectId,
    region: deployConfig.region,
  };

  const commonDeployArgs = {
    image: getArtifactsRegistryImage(context),
    ...commonArgs,
    "set-cloudsql-instances": deployConfig.cloudSql
      ? deployConfig.cloudSql.instanceConnectionName
      : undefined,
  };

  const serviceName = getServiceName(context);

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
  const jobsWithSchedule = jobsWithNames
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

  const getServiceDeployScript = (
    service: DeployConfigCloudRunService | true | undefined,
    nameSuffix?: string
  ) => {
    const customConfig = service !== true ? service : undefined;
    const command =
      service !== true
        ? service?.command ?? context.componentConfig.build.startCommand
        : undefined;

    const commandArray = command
      ? Array.isArray(command)
        ? command
        : command.split(" ")
      : undefined;
    const argsString = createArgsString({
      // command as empty string resets it to default (uses the image's entrypoint)
      command: commandArray ? '"' + commandArray.join(",") + '"' : '""',
      ...commonDeployArgs,
      labels: makeLabelString(getLabels(context)),
      "env-vars-file": "____envvars.yaml",
      "min-instances": customConfig?.minInstances ?? 0,
      "max-instances": customConfig?.maxInstances ?? 100,
      "cpu-throttling": customConfig?.noCpuThrottling !== true,
      memory: customConfig?.memory,
      "allow-unauthenticated": customConfig?.allowUnauthenticated ?? true,
      ingress: customConfig?.ingress ?? "all",
      "cpu-boost": true,
    });

    return `gcloud run deploy ${serviceName}${nameSuffix ?? ""} ${argsString}`;
  };

  const getJobCreateScriptsForJob = (
    jobName: string,
    job: DeployConfigCloudRunJob
  ) => {
    // due to some oversight from google, jobs create does not accept `--env-vars-file` 🤦
    // lucky, update on the other hand accepts it... so let's just imediatly update it

    // also we cannot upsert a job, so we have to create it and catch the error and then update

    const commandArray = Array.isArray(job.command)
      ? job.command
      : job.command.split(" ");

    const commonDeployArgsString = createArgsString({
      command: '"' + commandArray.join(",") + '"',
      ...commonDeployArgs,
      labels: makeLabelString(getLabels(context)),
      image: job.image || commonDeployArgs.image,
      memory: job.memory || "512Mi",
      "task-timeout": job.timeout || "10m",
    });

    const argsString = `${jobName} ${commonDeployArgsString}`;
    return [
      ...allowFailureInScripts([`gcloud beta run jobs create ${argsString}`]),
      `gcloud beta run jobs update ${argsString} --env-vars-file=____envvars.yaml`,
    ];
  };

  const commonArgsString = createArgsString(commonArgs);

  const getJobCreateScripts = () =>
    jobsWithNames
      .map(({ job, jobName }) => getJobCreateScriptsForJob(jobName, job))
      .flat();

  const getJobRunScriptForJob = (jobName: string, wait: boolean) => {
    return `gcloud beta run jobs execute ${jobName} ${commonArgsString}${
      wait ? " --wait" : ""
    }`;
  };

  const getJobRunScripts = (when: DeployConfigCloudRunJob["when"]) =>
    jobsWithNames
      .filter(({ job }) => job.when === when)
      .map(({ jobName }) =>
        getJobRunScriptForJob(
          jobName,
          // wait for completin on stop jobs, since stop will delete the jobs afterwards, so they will fail
          ["preStop", "postStop"].includes(when)
        )
      );

  const getCreateScheduleScripts = () => {
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
            `gcloud scheduler jobs create ${commonArgs}`,
          ]),
          `gcloud scheduler jobs update ${commonArgs}`,
        ];
      })
      .flat();
  };

  const getDeleteSchedulesScripts = () => {
    const argsString = createArgsString({
      project: deployConfig.projectId,
      location: deployConfig.region,
    });
    return jobsWithSchedule
      .map(({ schedulerName }) => {
        return [`gcloud scheduler jobs delete ${schedulerName} ${argsString}`];
      })
      .flat();
  };

  const getDeleteJobsScripts = () =>
    jobsWithNames.flatMap(({ jobName }) => [
      // first delete all job executions. Otherwise delete might fail if one of those is still running
      `gcloud beta run jobs executions list ${commonArgsString} --job ${jobName} --format="value(name)" | xargs -I {} gcloud beta run jobs executions delete {}  --quiet ${commonArgsString}`,
      `gcloud beta run jobs delete ${jobName} ${commonArgsString}`,
    ]);

  const deployScripts = [
    ...collapseableSection(
      "prepare",
      "Prepare..."
    )([
      ...gcloudServiceAccountLoginCommands(context),
      ...setGoogleProjectNumberScript(deployConfig),
    ]),
    ...collapseableSection(
      "deploy",
      "Deploy to cloud run"
    )([
      `echo "$ENV_VARS" > ____envvars.yaml`, // TODO: split secrets out
      ...(deployConfig.cloudSql
        ? getDatabaseCreateScript(context, deployConfig) // we create the db, so that we can also delete it afterwards
        : []),
      ...getCreateScheduleScripts(),
      ...getJobCreateScripts(),
      ...getJobRunScripts("preDeploy"),

      ...(deployConfig.service !== false
        ? [getServiceDeployScript(deployConfig.service)]
        : []),
      ...Object.entries(deployConfig.additionalServices ?? {}).map(
        ([name, service]) => getServiceDeployScript(service, "-" + name)
      ),
      ...getJobRunScripts("postDeploy"),
    ]),
    ...collapseableSection(
      "cleanup",
      "Cleanup"
    )(
      getRemoveOldRevisionsAndImagesCommand(context, "postDeploy") // we cleanup inactive images both on deploy and stop
    ),
    ...getDependencyTrackUploadScript(context),
  ];

  const stopScripts = [
    ...gcloudServiceAccountLoginCommands(context),
    ...getJobRunScripts("preStop"),
    ...(deployConfig.service !== false
      ? [`gcloud run services delete ${serviceName} ${commonArgsString}`]
      : []),
    ...Object.entries(deployConfig.additionalServices ?? {}).map(
      ([name]) =>
        `gcloud run services delete ${serviceName}-${name} ${commonArgsString}`
    ),
    ...getJobRunScripts("postStop"),
    ...getDeleteSchedulesScripts(),
    ...getDeleteJobsScripts(),
    ...(deployConfig.cloudSql && deployConfig.cloudSql.deleteDatabaseOnStop
      ? getDatabaseDeleteScript(context, deployConfig)
      : []),

    ...getRemoveOldRevisionsAndImagesCommand(context, "onStop"), // we cleanup inactive images both on deploy and stop
    ...getDependencyTrackDeleteScript(context),
  ];
  return createDeployementJobs(context, {
    deploy: merge(getDockerJobBaseProps(context), {
      artifacts: { paths: ["____envvars.yaml"] },
      variables: {
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
        ENV_VARS: dump(allEnvVars, {
          lineWidth: -1,
          quotingType: "'",
          forceQuotes: true,
        }),
      },
      image: getRunnerImage("gcloud"),
      script: deployScripts,
    }),
    stop: {
      image: getRunnerImage("gcloud"),
      variables: {
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
      },
      script: allowFailureInScripts(stopScripts),
    },
  });
};
