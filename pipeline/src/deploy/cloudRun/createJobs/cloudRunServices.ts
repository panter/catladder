import { getLabels } from "../../../context/getLabels";
import type { ComponentContext } from "../../../types/context";

import type { DeployConfigCloudRunService } from "../../types/googleCloudRun";
import { createArgsString } from "../utils/createArgsString";
import { getServiceName } from "../utils/getServiceName";
import {
  gcloudRunCmd,
  getCommonCloudRunArgs,
  getCommonDeployArgs,
  makeLabelString,
} from "./common";
import { ENV_VARS_FILENAME } from "./constants";
import { createVolumeConfig } from "./volumes";

export const getServiceDeployScript = (
  context: ComponentContext,
  service: DeployConfigCloudRunService | true | undefined,
  nameSuffix?: string,
) => {
  const commonDeployArgs = getCommonDeployArgs(context);

  const serviceName = getServiceName(context);

  const customConfig = service !== true ? service : undefined;
  const command =
    service !== true
      ? service?.command ?? context.build.config.startCommand
      : undefined;

  const commandArray = command
    ? Array.isArray(command)
      ? command
      : command.split(" ")
    : undefined;
  const fullServiceName = serviceName.concat(nameSuffix ?? "");
  const argsString = createArgsString(
    {
      // command as empty string resets it to default (uses the image's entrypoint)
      command: commandArray ? '"' + commandArray.join(",") + '"' : '""',
      ...commonDeployArgs,
      labels: makeLabelString({
        ...getLabels(context),
        "cloud-run-service-name": fullServiceName,
      }),
      "env-vars-file": ENV_VARS_FILENAME,
      "min-instances": customConfig?.minInstances ?? 0,
      "max-instances": customConfig?.maxInstances ?? 100,
      "cpu-throttling": customConfig?.noCpuThrottling !== true,
      cpu: customConfig?.cpu,
      memory: customConfig?.memory,
      timeout: customConfig?.timeout,
      "vpc-connector": customConfig?.vpcConnector,
      "vpc-egress": customConfig?.vpcEgress,
      network: customConfig?.network,
      subnet: customConfig?.subnet,
      "use-http2": customConfig?.http2,
      "allow-unauthenticated": customConfig?.allowUnauthenticated ?? true,
      ingress: customConfig?.ingress ?? "all",
      "cpu-boost": true,
      "execution-environment": customConfig?.executionEnvironment,
    },
    ...createVolumeConfig(customConfig?.volumes, "service"),
  );
  // volumes require beta
  const requiresBeta =
    customConfig?.volumes && Object.keys(customConfig?.volumes).length > 0;

  return `${gcloudRunCmd(
    requiresBeta ? "beta" : undefined,
  )} deploy ${fullServiceName} ${argsString}`;
};

export const getServiceDeleteScript = (
  context: ComponentContext,
  serviceSuffix?: string,
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
