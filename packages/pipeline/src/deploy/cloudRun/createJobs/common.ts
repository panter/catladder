import type { ComponentContext } from "../../../types/context";

import { getGcloudProjectNumber } from "../../../store";
import { isOfDeployType } from "../../types";
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

/**
 * the default compute service account of the gcloud project — used by
 * cloud scheduler to authenticate its calls
 */
export const getComputeServiceAccountEmail = (context: ComponentContext) => {
  const deployConfig = getCloudRunDeployConfig(context);
  return `${getGcloudProjectNumber(
    context.fullConfig,
    deployConfig.projectId,
  )}-compute@developer.gserviceaccount.com`;
};

export const makeLabelString = (obj: Record<string, unknown>) =>
  Object.entries(obj)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");

export const getCloudRunDeployConfig = (context: ComponentContext) => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }
  return deployConfig;
};

export function getCommonCloudRunArgs(context: ComponentContext) {
  const deployConfig = getCloudRunDeployConfig(context);
  return {
    project: deployConfig.projectId,
    region: deployConfig.region,
  };
}

export function getCommonDeployArgs(context: ComponentContext) {
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
