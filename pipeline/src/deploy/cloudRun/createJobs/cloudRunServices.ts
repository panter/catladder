import { getLabels } from "../../../context/getLabels";
import type { Context } from "../../../types/context";

import type { DeployConfigCloudRunService } from "../../types/googleCloudRun";
import { createArgsString } from "../utils/createArgsString";
import { getServiceName } from "../utils/getServiceName";
import {
  gcloudRunCmd,
  getCommonCloudRunArgs,
  getCommonDeployArgs,
  makeLabelString,
} from "./common";

export const getServiceDeployScript = (
  context: Context,
  service: DeployConfigCloudRunService | true | undefined,
  nameSuffix?: string
) => {
  const commonDeployArgs = getCommonDeployArgs(context);

  const serviceName = getServiceName(context);

  const customConfig = service !== true ? service : undefined;
  const command =
    service !== true
      ? service?.command ?? context.componentConfig.build.startCommand
      : undefined;

  const commandArray = command
    ? Array.isArray(command)
      ? command
      : command.split(" ")
    : undefined;
  const fullServiceName = `${serviceName}${nameSuffix ?? ""}`;
  const argsString = createArgsString({
    // command as empty string resets it to default (uses the image's entrypoint)
    command: commandArray ? '"' + commandArray.join(",") + '"' : '""',
    ...commonDeployArgs,
    labels: makeLabelString({
      ...getLabels(context),
      "cloud-run-service-name": fullServiceName,
    }),
    "env-vars-file": "____envvars.yaml",
    "min-instances": customConfig?.minInstances ?? 0,
    "max-instances": customConfig?.maxInstances ?? 100,
    "cpu-throttling": customConfig?.noCpuThrottling !== true,
    memory: customConfig?.memory,
    "allow-unauthenticated": customConfig?.allowUnauthenticated ?? true,
    ingress: customConfig?.ingress ?? "all",
    "cpu-boost": true,
    "execution-environment": customConfig?.executionEnvironment,
  });

  return `${gcloudRunCmd()} deploy ${fullServiceName} ${argsString}`;
};

export const getServiceDeleteScript = (
  context: Context,
  serviceSuffix?: string
) => {
  const commonArgs = getCommonCloudRunArgs(context);

  const commonArgsString = createArgsString(commonArgs);

  const serviceName = getServiceName(context);

  const fullServiceName = serviceSuffix
    ? `${serviceName}-${serviceSuffix}`
    : serviceName;

  return [
    `${gcloudRunCmd()} services delete ${fullServiceName} ${commonArgsString}`,
  ];
};
