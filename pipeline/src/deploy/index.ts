import { Context } from "../types/context";
import { CatladderJob } from "../types/jobs";
import { CUSTOM_DEPLOY_TYPE } from "./custom";
import { KUBERNETES_DEPLOY_TYPE } from "./kubernetes";
import { DeployConfigGeneric, DeployConfigType } from "./types";
export * from "./kubernetes";
export * from "./types";
export * from "./utils";

export type DeployTypeDefinition<T extends DeployConfigType> = {
  jobs: (context: Context) => CatladderJob[];
  defaults: () => Partial<DeployConfigGeneric<T>>;
  additionalSecretKeys: (config: DeployConfigGeneric<T>) => string[];
};
export type DeployTypes = {
  [T in DeployConfigType]: DeployTypeDefinition<T>;
};

export const DEPLOY_TYPES: DeployTypes = {
  kubernetes: KUBERNETES_DEPLOY_TYPE,
  custom: CUSTOM_DEPLOY_TYPE,
};
