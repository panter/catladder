import { dump } from "js-yaml";
import { merge, omit } from "lodash";
import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from ".";
import { getDockerJobBaseProps, gitlabDockerLogin } from "../../build/docker";
import { getLabels } from "../../context/getLabels";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { getBaseDeploymentJob, getBaseDeploymentStopJob } from "../base";
import type {
  DeployConfigCloudRunJob,
  DeployConfigCloudRunService,
} from "../types";
import { isOfDeployType } from "../types";
import { gcloudServiceAccountLoginCommands } from "./utils/gcloudServiceAccountLoginCommands";
import {
  getDatabaseCreateScript,
  getDatabaseDeleteScript,
} from "./utils/database";
import { allowFailureInScripts } from "../../utils/gitlab";

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
    ...gcloudServiceAccountLoginCommands(context),
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

  const getServiceDeployScript = (
    service?: DeployConfigCloudRunService | true
  ) => {
    const command =
      service !== true
        ? service?.command ?? context.componentConfig.build.startCommand
        : undefined;

    const commandArg = command
      ? `--command="${command.split(" ").join(",")}"`
      : "";

    return `gcloud run deploy ${serviceName} ${commandArg} ${commonDeployArgs} --env-vars-file=____envvars.yaml --allow-unauthenticated`;
  };

  const getJobCreateScripts = (
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

  const getJobRunScript = (jobName: string) => {
    return `gcloud beta run jobs execute ${jobName} ${commonArgs}`;
  };

  const getFullJobName = (name: string) =>
    context.environment.fullName.toLowerCase() + "-" + name.toLowerCase();

  const jobsWithNames = Object.entries(deployConfig.jobs ?? {})
    // filter out disabled jobs
    .filter((entry): entry is [string, DeployConfigCloudRunJob] =>
      Boolean(entry[1])
    )
    .map(([name, job]) => [getFullJobName(name), job] as const);
  const cloudRunDeployScripts = [
    `echo "$ENV_VARS" > ____envvars.yaml`, // TODO: split secrets out
    ...(deployConfig.cloudSql
      ? getDatabaseCreateScript(context, deployConfig) // we create the db, so that we can also delete it afterwards
      : []),

    ...jobsWithNames
      .map(([name, job]) => getJobCreateScripts(name, job))
      .flat(),
    ...jobsWithNames
      .filter(([, job]) => job.when === "preDeploy")
      .map(([name]) => getJobRunScript(name)),

    ...(deployConfig.service !== false
      ? [getServiceDeployScript(deployConfig.service)]
      : []),

    ...jobsWithNames
      .filter(([, job]) => job.when === "postDeploy")
      .map(([name]) => getJobRunScript(name)),
    `docker image rm ${gcloudImageName}`,
  ];

  const cloudRunStopScripts = [
    ...(deployConfig.service !== false
      ? [`gcloud run services delete ${serviceName} ${commonArgs}`]
      : []),
    ...jobsWithNames.map(
      ([name]) => `gcloud beta run jobs delete ${name} ${commonArgs}`
    ),
    ...(deployConfig.cloudSql && deployConfig.cloudSql.deleteDatabaseOnStop
      ? getDatabaseDeleteScript(context, deployConfig)
      : []),
  ];

  const baseStopJob = getBaseDeploymentStopJob(context);

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
      script: [...pushImageToArtifactsRegistry, ...cloudRunDeployScripts],
    }),

    merge({}, baseStopJob, {
      image: getRunnerImage("gcloud"),
      variables: {
        CLOUDSDK_CORE_DISABLE_PROMPTS: "1",
      },
      script: [
        ...gcloudServiceAccountLoginCommands(context),
        ...cloudRunStopScripts,
      ],
    }),
  ];
};
