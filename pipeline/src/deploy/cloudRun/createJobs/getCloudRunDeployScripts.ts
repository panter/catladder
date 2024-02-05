import type { Context } from "../../../types/context";
import { collapseableSection } from "../../../utils/gitlab";
import { getDependencyTrackUploadScript } from "../../sbom";

import { getRemoveOldRevisionsAndImagesCommand } from "../cleanup";
import { getDatabaseCreateScript } from "../utils/database";
import { gcloudServiceAccountLoginCommands } from "../utils/gcloudServiceAccountLoginCommands";
import {
  getCreateScheduleScripts,
  getJobCreateScripts,
  getJobRunScripts,
} from "./cloudRunJobs";
import { getServiceDeployScript } from "./cloudRunServices";
import {
  getCloudRunDeployConfig,
  setGoogleProjectNumberScript,
} from "./common";

export function getCloudRunDeployScripts(context: Context) {
  const deployConfig = getCloudRunDeployConfig(context);
  return [
    ...collapseableSection(
      "prepare",
      "Prepare..."
    )([
      ...gcloudServiceAccountLoginCommands(context),
      ...setGoogleProjectNumberScript(deployConfig),
    ]),
    ...collapseableSection(
      "deploy",
      "Deploy to cloud run"
    )([
      `echo "$ENV_VARS" > ____envvars.yaml`, // TODO: split secrets out
      ...(deployConfig.cloudSql
        ? getDatabaseCreateScript(context, deployConfig) // we create the db, so that we can also delete it afterwards
        : []),
      ...getCreateScheduleScripts(context),
      ...getJobCreateScripts(context),
      ...getJobRunScripts(context, "preDeploy"),

      ...(deployConfig.service !== false
        ? [getServiceDeployScript(context, deployConfig.service)]
        : []),
      ...Object.entries(deployConfig.additionalServices ?? {}).map(
        ([name, service]) =>
          getServiceDeployScript(context, service, "-" + name)
      ),
      ...getJobRunScripts(context, "postDeploy"),
    ]),
    ...collapseableSection(
      "cleanup",
      "Cleanup"
    )(
      getRemoveOldRevisionsAndImagesCommand(context, "postDeploy") // we cleanup inactive images both on deploy and stop
    ),
    ...getDependencyTrackUploadScript(context),
  ];
}
