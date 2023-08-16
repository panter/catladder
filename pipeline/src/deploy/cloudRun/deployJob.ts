import { dump } from "js-yaml";
import { merge, omit } from "lodash";
import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from ".";
import { getDockerJobBaseProps, gitlabDockerLogin } from "../../build/docker";
import { getLabels } from "../../context/getLabels";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { allowFailureInScripts } from "../../utils/gitlab";
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

const setExtraVarsScripts = (deployConfig: DeployConfigCloudRun) => [
  `export GCLOUD_PROJECT_NUMBER=$(gcloud projects describe ${deployConfig.projectId} --format="value(projectNumber)")`,
  `echo "GCLOUD_PROJECT_NUMBER: $GCLOUD_PROJECT_NUMBER"`,
];

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

  const fullAppName = `${context.fullConfig.customerName}-${context.fullConfig.appName}`;
  const dockerUrl = `${deployConfig.region}-docker.pkg.dev/${deployConfig.projectId}/catladder-deploy/${fullAppName}`;
  const gcloudImageName = `${dockerUrl}/$DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG`;

  const pushImageToArtifactsRegistry = [
    gitlabDockerLogin,
    `gcloud auth configure-docker ${deployConfig.region}-docker.pkg.dev`,
    `docker pull $DOCKER_IMAGE:$DOCKER_IMAGE_TAG`,
    `docker tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG ${gcloudImageName}`,
    `docker push ${gcloudImageName}`,
  ];

  const allEnvVars = omit(
    context.environment.envVars,
    GCLOUD_DEPLOY_CREDENTIALS_KEY
  );

  const labelsString = Object.entries(getLabels(context))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");

  const commonArgs = {
    project: deployConfig.projectId,
    region: deployConfig.region,
  };

  const commonDeployArgs = {
    image: gcloudImageName,
    ...commonArgs,
    "set-cloudsql-instances": deployConfig.cloudSql
      ? deployConfig.cloudSql.instanceConnectionName
      : undefined,
    labels: labelsString,
  };

  const serviceName = context.environment.fullName.toLowerCase();

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

    const argsString = createArgsString({
      // command as empty string resets it to default (uses the image's entrypoint)
      command: command ? '"' + command.split(" ").join(",") + '"' : '""',
      ...commonDeployArgs,
      "env-vars-file": "____envvars.yaml",
      "min-instances": customConfig?.minInstances ?? 0,
      "max-instances": customConfig?.maxInstances ?? 100,
      "cpu-throttling": customConfig?.noCpuThrottling !== true,
      memory: customConfig?.memory,
      "allow-unauthenticated": customConfig?.allowUnauthenticated ?? true,
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
    const commonDeployArgsString = createArgsString({
      command: '"' + job.command.split(" ").join(",") + '"',
      ...commonDeployArgs,
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

  const getJobRunScriptForJob = (jobName: string) => {
    return `gcloud beta run jobs execute ${jobName} ${commonArgsString}`;
  };

  const getJobRunScripts = (when: DeployConfigCloudRunJob["when"]) =>
    jobsWithNames
      .filter(({ job }) => job.when === when)
      .map(({ jobName }) => getJobRunScriptForJob(jobName));

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
    ...gcloudServiceAccountLoginCommands(context),
    ...setExtraVarsScripts(deployConfig),
    ...pushImageToArtifactsRegistry,
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

    `docker image rm ${gcloudImageName}`,
    ...getDependencyTrackUploadScript(context),
  ];

  const stopScripts = [
    ...gcloudServiceAccountLoginCommands(context),
    ...(deployConfig.service !== false
      ? [`gcloud run services delete ${serviceName} ${commonArgsString}`]
      : []),
    ...Object.entries(deployConfig.additionalServices ?? {}).map(
      ([name]) =>
        `gcloud run services delete ${serviceName}-${name} ${commonArgsString}`
    ),
    ...getDeleteSchedulesScripts(),
    ...getDeleteJobsScripts(),
    ...(deployConfig.cloudSql && deployConfig.cloudSql.deleteDatabaseOnStop
      ? getDatabaseDeleteScript(context, deployConfig)
      : []),
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
