import type { Config, EnvType } from "../types";
import type { CommitInfo, Context } from "../types/context";
import type { CatladderJob } from "../types/jobs";
import { GCLOUD_RUN_DEPLOY_TYPE } from "./cloudRun";
import { CUSTOM_DEPLOY_TYPE } from "./custom";
import { DOCKER_TAG_DEPLOY_TYPE } from "./dockerTag";
import { KUBERNETES_DEPLOY_TYPE } from "./kubernetes";
import type { DeployConfigGeneric, DeployConfigType } from "./types";
export * from "./kubernetes";
export * from "./types";
export * from "./utils";

export type EnvVarContext<D extends DeployConfigType> = {
  deployConfig: false | DeployConfigGeneric<D>;
  commitInfo?: CommitInfo;
  env: string;
  envType: EnvType;
  componentName: string;
  fullName: string;

  /**
   * the full catladder config
   */
  fullConfig: Config;
};

export type DeployTypeDefinition<T extends DeployConfigType> = {
  jobs: (context: Context) => CatladderJob[];
  defaults: () => Partial<DeployConfigGeneric<T>>;
  additionalSecretKeys: (envVarContext: EnvVarContext<T>) => string[];
  getAdditionalEnvVars: (
    envVarContext: EnvVarContext<T>
  ) => Record<string, string | undefined | null>;
};
export * from "./cloudSql";
export * from "./cloudRun";
export type DeployTypes = {
  [T in DeployConfigType]: DeployTypeDefinition<T>;
};

export const DEPLOY_TYPES: DeployTypes = {
  kubernetes: KUBERNETES_DEPLOY_TYPE,
  custom: CUSTOM_DEPLOY_TYPE,
  dockerTag: DOCKER_TAG_DEPLOY_TYPE,
  "google-cloudrun": GCLOUD_RUN_DEPLOY_TYPE,
};
