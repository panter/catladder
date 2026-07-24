import type { BuildConfig, SecretEnvVar } from "..";
import type { BashExpression } from "../bash/BashExpression";
import type { ComponentContext } from "../types/context";
import type { EnvironmentContext } from "../types/environmentContext";
import type { CatladderJob } from "../types/jobs";
import type { PartialDeep } from "../types/utils";
import { GCLOUD_RUN_DEPLOY_TYPE } from "./cloudRun";
import { CUSTOM_DEPLOY_TYPE } from "./custom";
import { DOCKER_TAG_DEPLOY_TYPE } from "./dockerTag";
import { KUBERNETES_DEPLOY_TYPE } from "./kubernetes";
import type {
  DeployConfig,
  DeployConfigGeneric,
  DeployConfigType,
} from "./types";
export * from "./cloudRun";
export * from "./kubernetes";
export * from "./types";
export * from "./utils";

export type DeployTypeDefinition<D extends DeployConfig> = {
  jobs: (context: ComponentContext) => CatladderJob[] | Promise<CatladderJob[]>;
  defaults: (envContext: EnvironmentContext<BuildConfig, D>) => PartialDeep<D>;
  additionalSecretKeys: (
    envContext: EnvironmentContext<BuildConfig, D>,
  ) => SecretEnvVar[];
  getAdditionalEnvVars: (
    envContext: EnvironmentContext<BuildConfig, D>,
  ) => Record<string, string | BashExpression | undefined | null>;
  /**
   * script lines the deploy type contributes to the start of the verify job,
   * e.g. to authenticate against a non-public service
   */
  verifyJobSetupScript?: (context: ComponentContext) => string[];
};
export type DeployTypes = {
  [T in DeployConfigType]: DeployTypeDefinition<DeployConfigGeneric<T>>;
};

export const DEPLOY_TYPES: DeployTypes = {
  kubernetes: KUBERNETES_DEPLOY_TYPE,
  custom: CUSTOM_DEPLOY_TYPE,
  dockerTag: DOCKER_TAG_DEPLOY_TYPE,
  "google-cloudrun": GCLOUD_RUN_DEPLOY_TYPE,
};
