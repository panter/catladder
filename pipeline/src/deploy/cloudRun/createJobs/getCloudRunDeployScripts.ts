import { omit } from "lodash-es";
import type { ComponentContext } from "../../../types/context";
import { collapseableSection } from "../../../utils/gitlab";

import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from "..";
import { writeBashYamlToFileScript } from "../../../bash/bashYaml";
import { getRemoveOldRevisionsAndImagesCommand } from "../cleanup";
import { getDatabaseCreateScript } from "../utils/database";
import { gcloudServiceAccountLoginCommands } from "../utils/gcloudServiceAccountLoginCommands";
import { getJobCreateScripts } from "./cloudRunJobs";
import { getOnDeployExecuteScript } from "./execute/onDeploy";
import { getServiceDeployScript } from "./cloudRunServices";
import { getWorkerPoolDeployScript } from "./cloudRunWorkerPools";
import {
  getCloudRunDeployConfig,
  setGoogleProjectNumberScript,
} from "./common";
import { ENV_VARS_FILENAME } from "./constants";
import { getCreateScheduleScript } from "./execute/schedules";
import type {
  DeployConfigCloudRunService,
  DeployConfigCloudRunWorkerPool,
} from "../../types";

export function getCloudRunDeployScripts(context: ComponentContext) {
  const deployConfig = getCloudRunDeployConfig(context);
  const allEnvVars = omit(
    context.environment.envVars,
    GCLOUD_DEPLOY_CREDENTIALS_KEY,
  );

  return [
    ...collapseableSection(
      "prepare",
      "Prepare...",
    )([
      ...gcloudServiceAccountLoginCommands(context),
      ...setGoogleProjectNumberScript(deployConfig),
    ]),
    ...collapseableSection(
      "writeenvvars",
      "Write env vars to file",
    )(writeBashYamlToFileScript(allEnvVars, ENV_VARS_FILENAME)),

    ...collapseableSection(
      "deploy",
      "Deploy to cloud run",
    )([
      ...(deployConfig.cloudSql
        ? getDatabaseCreateScript(context, deployConfig) // we create the db, so that we can also delete it afterwards
        : []),
      ...getCreateScheduleScript(context),
      ...getJobCreateScripts(context),
      ...getOnDeployExecuteScript(context, "preDeploy"),

      ...(deployConfig.service !== false
        ? [getServiceDeployScript(context, deployConfig.service)]
        : []),
      ...Object.entries(deployConfig.additionalServices ?? {})
        .filter(([_, service]) => service !== false && service !== null)
        .map(([name, service]) =>
          getServiceDeployScript(
            context,
            service as DeployConfigCloudRunService,
            "-" + name,
          ),
        ),
      ...Object.entries(deployConfig.workerPools ?? {})
        .filter(
          ([_, workerPool]) => workerPool !== false && workerPool !== null,
        )
        .map(([name, workerPool]) =>
          getWorkerPoolDeployScript(
            context,
            workerPool as DeployConfigCloudRunWorkerPool,
            name,
          ),
        ),
      ...getOnDeployExecuteScript(context, "postDeploy"),
    ]),
    ...collapseableSection(
      "cleanup",
      "Cleanup",
    )(
      getRemoveOldRevisionsAndImagesCommand(context, "postDeploy"), // we cleanup inactive images both on deploy and stop
    ),
  ];
}
