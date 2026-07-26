import type { DeployConfigCustom } from "./custom";
import type { DeployConfigDockerTag } from "./dockerTag";
import type { DeployConfigCloudRun } from "./googleCloudRun";
import type { DeployConfigKubernetes } from "./kubernetes";
import type { DeployConfigNpmPackage } from "./npmPackage";
import type { DeployConfigPages } from "./pages";

export * from "./custom";
export * from "./googleCloudRun";
export * from "./kubernetes";
export * from "./dockerTag";
export * from "./npmPackage";
export * from "./pages";

export type DeployConfig =
  | DeployConfigKubernetes
  | DeployConfigCustom
  | DeployConfigCloudRun
  | DeployConfigDockerTag
  | DeployConfigNpmPackage
  | DeployConfigPages;

export type DeployConfigType = DeployConfig["type"];
export type DeployConfigGeneric<T extends DeployConfigType> = Extract<
  DeployConfig,
  { type: T }
>;

export const isOfDeployType = <T extends Array<DeployConfigType>>(
  t: DeployConfig | false | null | undefined,
  ...types: T
): t is Extract<DeployConfig, { type: T[number] }> => {
  return t && types.includes(t.type) ? true : false;
};

export const getDeployConfigType = (
  t: DeployConfig | false | null | undefined,
) => {
  if (!t) return undefined;
  return t.type;
};
