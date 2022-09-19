import { dump } from "js-yaml";
import { merge, omit } from "lodash";
import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from ".";
import { getDockerJobBaseProps, gitlabDockerLogin } from "../../build/docker";
import { getLabels } from "../../context/getLabels";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types/context";
import type { CatladderJob } from "../../types/jobs";
import { getBaseDeploymentJob, getBaseDeploymentStopJob } from "../base";
import { isOfDeployType } from "../types";
import { gcloudServiceAccountLoginCommands } from "./utils/gcloudServiceAccountLoginCommands";

export const createDeployJob = (context: Context): CatladderJob[] => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is not custom");
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

  const serviceName = context.environment.fullName;

  const labelsString = Object.entries(getLabels(context))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");

  const command = context.componentConfig.build.startCommand
    ? `--command="${context.componentConfig.build.startCommand
        .split(" ")
        .join(",")}"`
    : "";
  // TODO: split secrets out
  const cloudRunDeploy = [
    `echo "$ENV_VARS" > ____envvars.yaml`,
    `gcloud run deploy ${serviceName} --image ${gcloudImageName} --region=${deployConfig.region} --allow-unauthenticated --project ${deployConfig.projectId} ${command} --env-vars-file=____envvars.yaml --labels ${labelsString}`,
    `docker image rm ${gcloudImageName}`,
  ];

  const baseStopJob = getBaseDeploymentStopJob(context);

  return [
    merge({}, baseDeploymentJob, getDockerJobBaseProps(context), {
      artifacts: { paths: ["____envvars.yaml"] },
      variables: {
        ENV_VARS: dump(allEnvVars, {
          lineWidth: -1,
          quotingType: "'",
          forceQuotes: true,
        }),
      },
      image: getRunnerImage("gcloud"),
      script: [...pushImageToArtifactsRegistry, ...cloudRunDeploy],
    }),

    merge({}, baseStopJob, {
      image: getRunnerImage("gcloud"),
      script: [
        ...gcloudServiceAccountLoginCommands(context),
        `gcloud run services delete ${serviceName} --project ${deployConfig.projectId} --region=${deployConfig.region} --quiet`,
      ],
    }),
  ];
};
