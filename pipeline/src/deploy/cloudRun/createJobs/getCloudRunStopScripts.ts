import type { ComponentContext } from "../../../types/context";

import { getRemoveOldRevisionsAndImagesCommand } from "../cleanup";
import { getDatabaseDeleteScript } from "../utils/database";
import { gcloudServiceAccountLoginCommands } from "../utils/gcloudServiceAccountLoginCommands";
import { getDeleteJobsScripts } from "./cloudRunJobs";
import { getOnDeployExecuteScript } from "./execute/onDeploy";
import { getDeleteSchedulesScript } from "./execute/schedules";
import { getServiceDeleteScript } from "./cloudRunServices";
import { getCloudRunDeployConfig } from "./common";

export function getCloudRunStopScripts(context: ComponentContext) {
  const deployConfig = getCloudRunDeployConfig(context);
  return [
    ...gcloudServiceAccountLoginCommands(context),
    ...getOnDeployExecuteScript(context, "preStop"),
    ...(deployConfig.service !== false ? getServiceDeleteScript(context) : []),
    ...Object.entries(deployConfig.additionalServices ?? {})
      .filter(([_, service]) => service !== false && service !== null)
      .flatMap(([name]) => getServiceDeleteScript(context, name)),
    ...getOnDeployExecuteScript(context, "postStop"),
    ...getDeleteSchedulesScript(context),
    ...getDeleteJobsScripts(context),
    ...(deployConfig.cloudSql && deployConfig.cloudSql.deleteDatabaseOnStop
      ? getDatabaseDeleteScript(context, deployConfig)
      : []),

    ...getRemoveOldRevisionsAndImagesCommand(context, "onStop"), // we cleanup inactive images both on deploy and stop
  ];
}
