import type { Context } from "../../../types/context";

import { isOfDeployType } from "../../types";
import type { DeployConfigCloudRun } from "../../types/googleCloudRun";
import { getArtifactsRegistryImage } from "../artifactsRegistry";

export const gcloudCmd = (version?: "beta") => {
  return version ? `gcloud ${version}` : "gcloud";
};
export const gcloudRunCmd = (version?: "beta") => {
  return `${gcloudCmd(version)} run`;
};

export const gcloudSchedulerCmd = (version?: "beta") => {
  return `${gcloudCmd(version)} scheduler`;
};

export const setGoogleProjectNumberScript = (
  deployConfig: DeployConfigCloudRun,
) => [
  `export GCLOUD_PROJECT_NUMBER=$(${gcloudCmd()} projects describe ${
    deployConfig.projectId
  } --format="value(projectNumber)")`,
  'echo "GCLOUD_PROJECT_NUMBER: $GCLOUD_PROJECT_NUMBER"',
];

export const makeLabelString = (obj: Record<string, unknown>) =>
  Object.entries(obj)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");

export const getCloudRunDeployConfig = (context: Context) => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }
  return deployConfig;
};

export function getCommonCloudRunArgs(context: Context) {
  const deployConfig = getCloudRunDeployConfig(context);
  return {
    project: deployConfig.projectId,
    region: deployConfig.region,
  };
}

export function getCommonDeployArgs(context: Context) {
  const commonArgs = getCommonCloudRunArgs(context);
  const deployConfig = getCloudRunDeployConfig(context);
  return {
    image: getArtifactsRegistryImage(context),
    ...commonArgs,
    "set-cloudsql-instances": deployConfig.cloudSql
      ? deployConfig.cloudSql.instanceConnectionName
      : undefined,
  };
}
