import { isNil, omit } from "lodash";
import type {
  ComponentContext,
  UnspecifiedEnvVars,
} from "../../../types/context";
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
import { GCLOUD_DEPLOY_CREDENTIALS_KEY } from "..";
import type { StringOrBashExpression } from "../../../bash/BashExpression";
import { BashExpression, bashEscape } from "../../../bash/BashExpression";
import { ENV_VARS_FILENAME } from "./constants";
import {
  writeBashYamlToFileScript,
  yamlBashString,
} from "../../../bash/bashYaml";

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
      ...getCreateScheduleScripts(context),
      ...getJobCreateScripts(context),
      ...getJobRunScripts(context, "preDeploy"),

      ...(deployConfig.service !== false
        ? [getServiceDeployScript(context, deployConfig.service)]
        : []),
      ...Object.entries(deployConfig.additionalServices ?? {}).map(
        ([name, service]) =>
          getServiceDeployScript(context, service, "-" + name),
      ),
      ...getJobRunScripts(context, "postDeploy"),
    ]),
    ...collapseableSection(
      "cleanup",
      "Cleanup",
    )(
      getRemoveOldRevisionsAndImagesCommand(context, "postDeploy"), // we cleanup inactive images both on deploy and stop
    ),
    ...getDependencyTrackUploadScript(context),
  ];
}
