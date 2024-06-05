import type { SecretEnvVar } from "..";
import type { BashExpression } from "../bash/BashExpression";
import type { Context } from "../types/context";
import type { EnvironmentContext } from "../types/environmentContext";
import type { CatladderJob } from "../types/jobs";
import type { PartialDeep } from "../types/utils";
import { GCLOUD_RUN_DEPLOY_TYPE } from "./cloudRun";
import { CUSTOM_DEPLOY_TYPE } from "./custom";
import { DOCKER_TAG_DEPLOY_TYPE } from "./dockerTag";
import { KUBERNETES_DEPLOY_TYPE } from "./kubernetes";
import type { DeployConfigGeneric, DeployConfigType } from "./types";
export * from "./cloudRun";
export * from "./kubernetes";
export * from "./types";
export * from "./utils";

export type DeployTypeDefinition<T extends DeployConfigType> = {
  jobs: (context: Context) => CatladderJob[];
  defaults: (
    envContext: EnvironmentContext<any, T>
  ) => PartialDeep<DeployConfigGeneric<T>>;
  additionalSecretKeys: (
    envContext: EnvironmentContext<any, T>
  ) => SecretEnvVar[];
  getAdditionalEnvVars: (
    envContext: EnvironmentContext<any, T>
  ) => Record<string, string | BashExpression | undefined | null>;
};
export type DeployTypes = {
  [T in DeployConfigType]: DeployTypeDefinition<T>;
};

export const DEPLOY_TYPES: DeployTypes = {
  kubernetes: KUBERNETES_DEPLOY_TYPE,
  custom: CUSTOM_DEPLOY_TYPE,
  dockerTag: DOCKER_TAG_DEPLOY_TYPE,
  "google-cloudrun": GCLOUD_RUN_DEPLOY_TYPE,
};
