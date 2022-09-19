import type { DeployConfigCustom } from "./custom";
import type { DeployConfigDockerTag } from "./dockerTag";
import type { DeployConfigCloudRun } from "./googleCloudRun";
import type { DeployConfigKubernetes } from "./kubernetes";

export * from "./custom";
export * from "./googleCloudRun";
export * from "./kubernetes";
export * from "./dockerTag";

export type DeployConfig =
  | DeployConfigKubernetes
  | DeployConfigCustom
  | DeployConfigCloudRun
  | DeployConfigDockerTag;

export type DeployConfigType = DeployConfig["type"];
export type DeployConfigGeneric<T extends DeployConfigType> = Extract<
  DeployConfig,
  { type: T }
>;

export const isOfDeployType = <T extends Array<DeployConfigType>>(
  t: DeployConfig | false,
  ...types: T
): t is Extract<DeployConfig, { type: T[number] }> => {
  return t && types.includes(t.type);
};
