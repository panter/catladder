import type { Context } from "../../types/context";
import { allowFailureInScripts } from "../../utils/gitlab";
import { isOfDeployType } from "../types";
import { removeFirstLinesFromCommandOutput } from "./utils/removeFirstLinesFromCommandOutput";

export const getArtifactsRegistryHost = ({
  componentConfig: { deploy },
}: Context) => {
  if (!isOfDeployType(deploy, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }
  return `${deploy.region}-docker.pkg.dev`;
};

export const getArtifactsRegistryDockerUrl = (context: Context) => {
  const deployConfig = context.componentConfig.deploy;

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
  context: Context,
  lecacyReviewImageName = false
) => {
  if (lecacyReviewImageName && context.environment.envType !== "review") {
    throw new Error("lecacyReviewImageName is only allowed for review app");
  }

  const dockerUrl = getArtifactsRegistryDockerUrl(context);
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

export const getArtifactsRegistryBuildCacheImage = (context: Context) => {
  const dockerUrl = getArtifactsRegistryDockerUrl(context);
  // does not include env, so that after merge, you might get more cache hits (review-->dev)
  const gcloudImagePath = [dockerUrl, "caches", context.componentName];
  return gcloudImagePath.join("/");
};

export const getArtifactsRegistryImage = (context: Context) =>
  `${getArtifactsRegistryImageName(context)}:$DOCKER_IMAGE_TAG`;

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
            0
          )
        )
      : []),
  ];
};
