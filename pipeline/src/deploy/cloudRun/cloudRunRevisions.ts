import type { ComponentContext } from "../../types/context";
import { isOfDeployType } from "../types";
import { createArgsString } from "./utils/createArgsString";
import { getServiceName } from "./utils/getServiceName";
import { removeFirstLinesFromCommandOutput } from "./utils/removeFirstLinesFromCommandOutput";

const getListRevisionsCommand = (
  context: ComponentContext,
  args: {
    filter?: string;
    format: string;
  },
) => {
  const serviceName = getServiceName(context);

  const deployConfig = context.deploy?.config;

  if (!deployConfig || !isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }
  const filterRevisionArgs = {
    project: deployConfig.projectId,
    region: deployConfig.region,
    // only show inactive revisions
    service: serviceName,

    limit: "unlimited", // is actualy the default
    "sort-by": "metadata.creationTimestamp",
    ...args,
  };

  // this prints out all inactive images of the given app
  return `gcloud run revisions list ${createArgsString(filterRevisionArgs)}`;
};

export const getDeleteUnusedRevisionsCommands = (
  context: ComponentContext,
  keep: number,
) => {
  const deployConfig = context.deploy?.config;
  if (!isOfDeployType(deployConfig, "google-cloudrun")) {
    // should not happen
    throw new Error("deploy config is wrong");
  }

  // this prints out all inactive images of the given app
  const listAllInactiveRevisionsCmd = getListRevisionsCommand(context, {
    format: `"value(name)"`,
    filter: `'(status.conditions.status=False OR status.conditions.status=Unknown)'`,
  });
  // this removes the newest `revisionsToKeep` images
  const listRevisionsToDeleteCmd = removeFirstLinesFromCommandOutput(
    listAllInactiveRevisionsCmd,
    keep,
  );
  const deleteRevisionCmd = `gcloud run revisions delete ${createArgsString({
    project: deployConfig.projectId,
    region: deployConfig.region,
    quiet: true,
  })} $revisionname `;

  const deleteRevisionsCmd = `${listRevisionsToDeleteCmd} | while read -r revisionname; do ${deleteRevisionCmd}; done`;
  return [deleteRevisionsCmd];
};
