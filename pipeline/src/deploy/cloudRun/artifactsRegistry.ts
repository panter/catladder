import { gitlabDockerLogin } from "../../build/docker";
import type { Context } from "../../types/context";
import { allowFailureInScripts } from "../../utils/gitlab";
import { isOfDeployType } from "../types";
import { removeFirstLinesFromCommandOutput } from "./utils/removeFirstLinesFromCommandOutput";

/**
 *
 * lecacyReviewImageName is only temporary. In old versions the images had no reviewslug in review apps, which makes cleanup harder. We delete all those images now, but need the path
 */
export const getArtifactsRegistryImageName = (
  context: Context,
  lecacyReviewImageName = false
) => {
  const deployConfig = context.componentConfig.deploy;

  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  if (lecacyReviewImageName && context.environment.envType !== "review") {
    throw new Error("lecacyReviewImageName is only allowed for review app");
  }
  const fullAppName = `${context.fullConfig.customerName}-${context.fullConfig.appName}`;

  const dockerUrl = `${deployConfig.region}-docker.pkg.dev/${deployConfig.projectId}/catladder-deploy/${fullAppName}`;
  const gcloudImagePath = [
    dockerUrl,
    context.environment.shortName,
    context.componentName,

    ...(context.environment.envType === "review" && !lecacyReviewImageName
      ? [context.commitInfo?.reviewSlug]
      : []),
  ];
  return gcloudImagePath.join("/");
};

export const getArtifactsRegistryImage = (context: Context) =>
  `${getArtifactsRegistryImageName(context)}:$DOCKER_IMAGE_TAG`;

/**
 * commands to pull the image from the default registry and pushes it to google artifact registry. We might build and push directly to google artifact registry in the future
 */
export const getPushToArtifactsRegistryCommands = (context: Context) => {
  const deployConfig = context.componentConfig.deploy;

  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  const fullImageName = getArtifactsRegistryImageName(context);

  return [
    gitlabDockerLogin,
    `gcloud auth configure-docker ${deployConfig.region}-docker.pkg.dev`,
    `docker pull $DOCKER_IMAGE:$DOCKER_IMAGE_TAG`,
    `docker tag $DOCKER_IMAGE:$DOCKER_IMAGE_TAG ${fullImageName}:$DOCKER_IMAGE_TAG`,
    `docker push ${fullImageName}:$DOCKER_IMAGE_TAG`,
  ];
};

const getDeleteImageCommands = (fullImageName: string, keepNewest = 0) => {
  if (keepNewest === 0) {
    // no need to list tags, we delete the whole thing
    return [
      `gcloud artifacts docker images delete ${fullImageName} --quiet --delete-tags`,
    ];
  }
  // delete unused tags
  const listAllImagesCommand = `gcloud artifacts docker images list ${fullImageName} --sort-by=~CREATE_TIME --format="value(version)"`;

  const listImagesToDeletecommand = removeFirstLinesFromCommandOutput(
    listAllImagesCommand,
    keepNewest
  );
  const deleteImageCommand = `gcloud artifacts docker images delete ${fullImageName}@$version --quiet --delete-tags`;

  const deleteImagesCommand = `${listImagesToDeletecommand} | while read -r version; do ${deleteImageCommand}; done`;

  return [deleteImagesCommand];
};

/**
 * commands to delete unused images.
 *
 * @param context
 * @param keep how many of the newest images to keep
 * @returns
 */
export const getDeleteUnusedImagesCommands = (context: Context, keep = 0) => {
  const deployConfig = context.componentConfig.deploy;
  if (deployConfig === false) {
    return [];
  }
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  const fullImageName = getArtifactsRegistryImageName(context);

  return [
    ...getDeleteImageCommands(fullImageName, keep),
    // because a recent version of catladder had no review-slug in the image name, we have to delete those as well
    // we can later remove this line in some months

    ...(context.environment.envType === "review"
      ? allowFailureInScripts(
          getDeleteImageCommands(
            getArtifactsRegistryImageName(context, true),
            0
          )
        )
      : []),
  ];
};
