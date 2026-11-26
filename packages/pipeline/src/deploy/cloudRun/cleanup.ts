import type { ComponentContext } from "../../types/context";
import { allowFailureInScripts } from "../../utils/gitlab";
import { getDeleteUnusedImagesCommands } from "./artifactsRegistry";
import { getDeleteUnusedRevisionsCommands } from "./cloudRunRevisions";

export const IMAGE_SAFETY_MARGIN = 4;

export const getRemoveOldRevisionsAndImagesCommand = (
  context: ComponentContext,
  when: "postDeploy" | "onStop",
) => {
  if (when === "onStop") {
    // service is already deleted, so we don't need to delete old revisions, just delete all images
    return getDeleteUnusedImagesCommands(context);
  }

  const deployConfig = context.deploy?.config;
  const configuredRevisionsToKeep =
    deployConfig && deployConfig.type === "google-cloudrun"
      ? deployConfig.revisionsToKeep
      : undefined;

  // this number only targets inactive revisions; the env type only
  // supplies the default (prod keeps a rollback history)
  const revisionsToKeep =
    configuredRevisionsToKeep ??
    (context.environment.envType === "prod" ? 5 : 0);

  const configuredImagesToKeep =
    deployConfig && deployConfig.type === "google-cloudrun"
      ? deployConfig.imagesToKeep
      : undefined;
  if (
    configuredImagesToKeep !== undefined &&
    (!Number.isInteger(configuredImagesToKeep) || configuredImagesToKeep < 1)
  ) {
    throw new Error("google-cloudrun imagesToKeep must be an integer >= 1");
  }

  // A concurrent pipeline may have pushed an image it has not deployed yet.
  // Keep a margin beyond inactive revisions and the currently serving image.
  const imagesToKeep = Math.max(
    configuredImagesToKeep ?? revisionsToKeep + 1 + IMAGE_SAFETY_MARGIN,
    revisionsToKeep + 1,
  );

  const deleteOldRevisionsCommands = getDeleteUnusedRevisionsCommands(
    context,
    revisionsToKeep,
  );
  const deleteOldImagesCommands = getDeleteUnusedImagesCommands(
    context,
    imagesToKeep,
  );

  return allowFailureInScripts([
    ...deleteOldRevisionsCommands,
    ...deleteOldImagesCommands,
  ]);
};
