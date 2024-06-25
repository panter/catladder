import type { StringOrBashExpression } from "../../bash/BashExpression";
import { joinBashExpressions } from "../../bash/BashExpression";
import type { ComponentContext } from "../../types/context";
import { allowFailureInScripts } from "../../utils/gitlab";
import { isOfDeployType } from "../types";
import { removeFirstLinesFromCommandOutput } from "./utils/removeFirstLinesFromCommandOutput";

export const getArtifactsRegistryHost = (context: ComponentContext) => {
  if (!isOfDeployType(context.deploy?.config, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }
  return `${context.deploy.config.region}-docker.pkg.dev`;
};

export const getArtifactsRegistryDockerUrl = (context: ComponentContext) => {
  const deployConfig = context.deploy?.config;

  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  const fullAppName = `${context.fullConfig.customerName}-${context.fullConfig.appName}`;

  return `${getArtifactsRegistryHost(context)}/${
    deployConfig.projectId
  }/catladder-deploy/${fullAppName}`;
};

/**
 *
 * lecacyReviewImageName is only temporary. In old versions the images had no reviewslug in review apps, which makes cleanup harder. We delete all those images now, but need the path
 */
export const getArtifactsRegistryImageName = (
  context: ComponentContext,
  lecacyReviewImageName = false,
) => {
  if (lecacyReviewImageName && context.environment.envType !== "review") {
    throw new Error("lecacyReviewImageName is only allowed for review app");
  }

  const dockerUrl = getArtifactsRegistryDockerUrl(context);
  const gcloudImagePath = [
    dockerUrl,
    context.env,
    context.componentName,

    ...(context.environment.reviewSlug && !lecacyReviewImageName
      ? [context.environment.reviewSlug]
      : []),
  ];
  return joinBashExpressions(gcloudImagePath, "/");
};

export const getArtifactsRegistryBuildCacheImage = (
  context: ComponentContext,
) => {
  const dockerUrl = getArtifactsRegistryDockerUrl(context);
  // does not include env, so that after merge, you might get more cache hits (review-->dev)
  const gcloudImagePath = [dockerUrl, "caches", context.componentName];
  return gcloudImagePath.join("/");
};

export const getArtifactsRegistryImage = (context: ComponentContext) =>
  `${getArtifactsRegistryImageName(context)}:$DOCKER_IMAGE_TAG`;

const getDeleteImageCommands = (
  fullImageName: StringOrBashExpression,
  keepNewest = 0,
) => {
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
    keepNewest,
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
export const getDeleteUnusedImagesCommands = (
  context: ComponentContext,
  keep = 0,
) => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  const fullImageName = getArtifactsRegistryImageName(context);
  const buildCacheImageName = getArtifactsRegistryBuildCacheImage(context);

  return [
    ...getDeleteImageCommands(fullImageName, keep),
    ...getDeleteImageCommands(buildCacheImageName, 1),
    // because a recent version of catladder had no review-slug in the image name, we have to delete those as well
    // we can later remove this line in some months

    ...(context.environment.envType === "review"
      ? allowFailureInScripts(
          getDeleteImageCommands(
            getArtifactsRegistryImageName(context, true),
            0,
          ),
        )
      : []),
  ];
};
