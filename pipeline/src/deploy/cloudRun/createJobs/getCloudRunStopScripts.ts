import type { ComponentContext } from "../../../types/context";
import { getDependencyTrackDeleteScript } from "../../sbom";

import { getRemoveOldRevisionsAndImagesCommand } from "../cleanup";
import { getDatabaseDeleteScript } from "../utils/database";
import { gcloudServiceAccountLoginCommands } from "../utils/gcloudServiceAccountLoginCommands";
import {
  getDeleteJobsScripts,
  getDeleteSchedulesScripts,
  getJobRunScripts,
} from "./cloudRunJobs";
import { getServiceDeleteScript } from "./cloudRunServices";
import { getCloudRunDeployConfig } from "./common";

export function getCloudRunStopScripts(context: ComponentContext) {
  const deployConfig = getCloudRunDeployConfig(context);
  return [
    ...gcloudServiceAccountLoginCommands(context),
    ...getJobRunScripts(context, "preStop"),
    ...(deployConfig.service !== false ? getServiceDeleteScript(context) : []),
    ...Object.entries(deployConfig.additionalServices ?? {}).flatMap(([name]) =>
      getServiceDeleteScript(context, name),
    ),
    ...getJobRunScripts(context, "postStop"),
    ...getDeleteSchedulesScripts(context),
    ...getDeleteJobsScripts(context),
    ...(deployConfig.cloudSql && deployConfig.cloudSql.deleteDatabaseOnStop
      ? getDatabaseDeleteScript(context, deployConfig)
      : []),

    ...getRemoveOldRevisionsAndImagesCommand(context, "onStop"), // we cleanup inactive images both on deploy and stop
    ...getDependencyTrackDeleteScript(context),
  ];
}
