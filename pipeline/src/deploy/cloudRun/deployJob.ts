import { dump } from "js-yaml";
import { isNil, merge, omit } from "lodash";
import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from ".";
import { getDockerJobBaseProps, gitlabDockerLogin } from "../../build/docker";
import { getLabels } from "../../context/getLabels";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { getBaseDeploymentJob, getBaseDeploymentStopJob } from "../base";
import type {
  DeployConfigCloudRun,
  DeployConfigCloudRunJob,
  DeployConfigCloudRunJobWithSchedule,
  DeployConfigCloudRunService,
} from "../types";
import { isOfDeployType } from "../types";
import { gcloudServiceAccountLoginCommands } from "./utils/gcloudServiceAccountLoginCommands";
import {
  getDatabaseCreateScript,
  getDatabaseDeleteScript,
} from "./utils/database";
import { allowFailureInScripts } from "../../utils/gitlab";
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
  const baseDeploymentJob = getBaseDeploymentJob(context);

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

  const commonArgs = `--project ${deployConfig.projectId} --region=${deployConfig.region}`;
  const cloudRunArgs = deployConfig.cloudSql
    ? `--set-cloudsql-instances=${deployConfig.cloudSql.instanceConnectionName}`
    : "";
  const commonDeployArgs = `--image ${gcloudImageName} ${commonArgs} ${cloudRunArgs} --labels ${labelsString}`;
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

    const commandArg = command
      ? `--command="${command.split(" ").join(",")}"`
      : "";

    const args = {
      "allow-unauthenticated": true,
      "min-instances": customConfig?.minInstances,
      "max-instances": customConfig?.maxInstances,
      "no-cpu-throttling": customConfig?.noCpuThrottling,
    } as const;

    const argsString = Object.entries(args)
      .filter(([, value]) => !isNil(value))
      .map(([key, value]) => `--${key}${value !== true ? `=${value}` : ""}`)
      .join(" ");

    return `gcloud run deploy ${serviceName}${
      nameSuffix ?? ""
    } ${commandArg} ${commonDeployArgs} --env-vars-file=____envvars.yaml ${argsString}`;
  };

  const getJobCreateScriptsForJob = (
    jobName: string,
    job: DeployConfigCloudRunJob
  ) => {
    // due to some oversight from google, jobs create does not accept `--env-vars-file` 🤦
    // lucky, update on the other hand accepts it... so let's just imediatly update it

    // also we cannot upsert a job, so we have to create it and catch the error and then update
    const args = `${jobName} --command="${job.command
      .split(" ")
      .join(",")}" ${commonDeployArgs} --memory=${job.memory || "512Mi"}`;
    return [
      ...allowFailureInScripts([`gcloud beta run jobs create ${args}`]),
      `gcloud beta run jobs update ${args} --env-vars-file=____envvars.yaml`,
    ];
  };

  const getJobCreateScripts = () =>
    jobsWithNames
      .map(({ job, jobName }) => getJobCreateScriptsForJob(jobName, job))
      .flat();

  const getJobRunScriptForJob = (jobName: string) => {
    return `gcloud beta run jobs execute ${jobName} ${commonArgs}`;
  };

  const getJobRunScripts = (when: DeployConfigCloudRunJob["when"]) =>
    jobsWithNames
      .filter(({ job }) => job.when === when)
      .map(({ jobName }) => getJobRunScriptForJob(jobName));

  const getCreateScheduleScripts = () => {
    return jobsWithSchedule
      .map(({ job, jobName, schedulerName }) => {
        const commonArgs = `http ${schedulerName} --project=${deployConfig.projectId} --location ${deployConfig.region} \
      --schedule="${job.schedule}" \
      --uri="https://${deployConfig.region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${deployConfig.projectId}/jobs/${jobName}:run" \
      --http-method POST \
      --oauth-service-account-email $GCLOUD_PROJECT_NUMBER-compute@developer.gserviceaccount.com`;
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
    return jobsWithSchedule
      .map(({ schedulerName }) => {
        return [
          ...allowFailureInScripts([
            `gcloud scheduler jobs delete ${schedulerName} --project=${deployConfig.projectId} --location ${deployConfig.region}`,
          ]),
        ];
      })
      .flat();
  };

  const getDeleteJobsScripts = () =>
    jobsWithNames.map(
      ({ jobName }) => `gcloud beta run jobs delete ${jobName} ${commonArgs}`
    );

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
  ];

  const stopScripts = [
    ...gcloudServiceAccountLoginCommands(context),
    ...(deployConfig.service !== false
      ? [`gcloud run services delete ${serviceName} ${commonArgs}`]
      : []),
    ...Object.entries(deployConfig.additionalServices ?? {}).map(
      ([name]) =>
        `gcloud run services delete ${serviceName}-${name} ${commonArgs}`
    ),
    ...getDeleteSchedulesScripts(),
    ...getDeleteJobsScripts(),
    ...(deployConfig.cloudSql && deployConfig.cloudSql.deleteDatabaseOnStop
      ? getDatabaseDeleteScript(context, deployConfig)
      : []),
  ];
  return [
    merge({}, baseDeploymentJob, getDockerJobBaseProps(context), {
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

    merge({}, getBaseDeploymentStopJob(context), {
      image: getRunnerImage("gcloud"),
      variables: {
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
      },
      script: stopScripts,
    }),
  ];
};
