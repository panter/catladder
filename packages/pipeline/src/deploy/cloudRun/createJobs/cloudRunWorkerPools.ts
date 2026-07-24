import { getLabels } from "../../../context/getLabels";
import type { ComponentContext } from "../../../types/context";

import type { DeployConfigCloudRunWorkerPool } from "../../types/googleCloudRun";
import { createArgsString } from "../utils/createArgsString";
import { getCloudRunServiceOrJobArgsArg } from "../utils/getJobOrServiceArgs";
import { getServiceName } from "../utils/getServiceName";
import {
  gcloudRunCmd,
  getCommonCloudRunArgs,
  getCommonDeployArgs,
  makeLabelString,
} from "./common";
import { ENV_VARS_FILENAME } from "./constants";
import { createVolumeConfig } from "./volumes";

export const getWorkerPoolDeployScript = (
  context: ComponentContext,
  workerPool: DeployConfigCloudRunWorkerPool,
  nameSuffix: string,
) => {
  const commonDeployArgs = getCommonDeployArgs(context);

  const serviceName = getServiceName(context);

  const command = workerPool.command;

  const commandArray = Array.isArray(command) ? command : command.split(" ");

  const fullWorkerPoolName = `${serviceName}-${nameSuffix}`;

  const argsString = createArgsString(
    {
      command: '"' + commandArray.join(",") + '"',
      args: getCloudRunServiceOrJobArgsArg(workerPool.args),
      ...commonDeployArgs,
      image: workerPool.image ?? commonDeployArgs.image,
      labels: makeLabelString({
        ...getLabels(context),
        "cloud-run-worker-pool-name": fullWorkerPoolName,
      }),
      "env-vars-file": ENV_VARS_FILENAME,
      instances: workerPool.instances ?? 1,
      cpu: workerPool.cpu ?? 1,
      memory: workerPool.memory ?? "512Mi",
      "vpc-connector": workerPool.vpcConnector,
      "vpc-egress": workerPool.vpcEgress,
      network: workerPool.network,
      subnet: workerPool.subnet,
      gpu: workerPool.gpu,
      "gpu-type": workerPool.gpuType,
    },
    ...createVolumeConfig(workerPool.volumes, "worker-pool"),
  );

  // Worker pools are in beta and require the beta command
  return `${gcloudRunCmd("beta")} worker-pools deploy ${fullWorkerPoolName} ${argsString}`;
};

export const getWorkerPoolDeleteScript = (
  context: ComponentContext,
  workerPoolSuffix: string,
) => {
  const commonArgs = getCommonCloudRunArgs(context);

  const commonArgsString = createArgsString(commonArgs);

  const serviceName = getServiceName(context);

  const fullWorkerPoolName = `${serviceName}-${workerPoolSuffix}`;

  return [
    `${gcloudRunCmd("beta")} worker-pools delete ${fullWorkerPoolName} ${commonArgsString}`,
  ];
};
