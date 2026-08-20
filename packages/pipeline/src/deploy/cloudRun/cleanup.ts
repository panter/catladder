import type { ComponentContext } from "../../types/context";
import { allowFailureInScripts } from "../../utils/gitlab";
import { getDeleteUnusedImagesCommands } from "./artifactsRegistry";
import { getDeleteUnusedRevisionsCommands } from "./cloudRunRevisions";

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

  // this number needs to be higher than inactive after deploy, so we add one
  const imagesToKeep = revisionsToKeep + 1;

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
