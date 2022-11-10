import type { DeployConfigBase } from "./base";

export type Gcloudregion =
  | "asia-east1"
  | "asia-northeast1"
  | "asia-northeast2"
  | "europe-north1"
  | "europe-southwest1"
  | "europe-west1"
  | "europe-west4"
  | "europe-west8"
  | "europe-west9"
  | "me-west1"
  | "us-central1"
  | "us-east1"
  | "us-east4"
  | "us-east5"
  | "us-south1"
  | "us-west1"
  | "asia-east2"
  | "asia-northeast3"
  | "asia-southeast1"
  | "asia-southeast2"
  | "asia-south1"
  | "asia-south2"
  | "australia-southeast1"
  | "australia-southeast2"
  | "europe-central2"
  | "europe-west2"
  | "europe-west3"
  | "europe-west6"
  | "northamerica-northeast1"
  | "northamerica-northeast2"
  | "southamerica-east1"
  | "southamerica-west1"
  | "us-west2"
  | "us-west3"
  | "us-west4";

export type DeployConfigCloudRunBase = {
  /**
   * the google cloud porject id
   */
  projectId: string;
  /**
   * the region. Set to europe-west6 for switzerland
   */
  region: Gcloudregion;

  /**
   * command / entrypoint, fallsback to buildConfig.startcommand
   */
  command?: string;
} & DeployConfigBase;
export type DeployConfigCloudRunService = {
  /**
   * EXPERIMENTAL cloud run deployment.
   *
   * This will deploy a cloud run service.
   *
   * Requires that cloud run is enabled on the project, as well as cloud run api and artifacts registry.
   */
  type: "google-cloudrun";
} & DeployConfigCloudRunBase;

export type DeployConfigCloudRunJob = {
  /**
   * EXPERIMENTAL cloud run job.
   *
   * This will deploy a cloud run job. This does not do much currently, but will be later used for cronjobs
   *
   * Requires that cloud run is enabled on the project, as well as cloud run api and artifacts registry.
   */
  type: "google-cloudrun-job";
} & DeployConfigCloudRunBase;

export type DeployConfigCloudRun =
  | DeployConfigCloudRunService
  | DeployConfigCloudRunJob;
