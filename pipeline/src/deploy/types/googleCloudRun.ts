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

export type DeployConfigCloudRunCloudSql = {
  type: "unmanaged";
  instanceConnectionName: string;
  /**
   * the database username, defaults to "postgres"
   */
  dbUser?: string;

  /**
   * the prefix of the database, the full db name is this plus the environment slug prefix plus the componentName
   *
   * defaults to customerName-appName
   */
  dbNamePrefix?: string | false;

  /**
   * the base name of the db, defaults to the componentName
   */
  dbBaseName?: string;
  /**
   * whether to delete the database if the environment is stopped
   * defaults to true for review envs, to false for every other environment
   */
  deleteDatabaseOnStop?: boolean;

  /**
   * add additional query params to the database connection string
   */
  dbAdditionalQueryParams?: Record<string, string | number> & {
    /**
     * set to 0 for prisma in review or dev apps where you reset the db occasionally without restarting any server
     */
    statement_cache_size?: number;
  };
};

type Memory = `${number}${"M" | "G" | "Mi" | "Gi"}`;
export type DeployConfigCloudRunService = {
  /**
   * command / entrypoint, fallsback to buildConfig.startcommand
   */
  command?: string;

  /**
   * how many instances to keep around when there are no requests. defaults to 0.
   * Set to 1 for workers
   */
  minInstances?: number;

  /**
   * maximum amount of instances. Defaults to 100
   */
  maxInstances?: number;

  /**
   * set to true to allways allocate cpu, e.g. for workers. Careful that this is expensive!
   */
  noCpuThrottling?: true;

  /**
   * whether to allow public access (defaults to true)
   */
  allowUnauthenticated?: boolean;

  /**
   * memory limit. Defaults to 512MB
   */
  memory?: Memory;
};

export type DeployConfigCloudRunJobBase = {
  /**
   * command
   */
  command: string;

  /**
   * memory limit of the job, defaults to 51Mi
   */
  memory?: `${number}${"M" | "G" | "Mi" | "Gi"}`;
};

type Minute = string;
type Hour = string;
type DayOfMonth = string;
type DayOfWeek = string;
type Month = string;
export type DeployConfigCloudRunJobWithSchedule =
  DeployConfigCloudRunJobBase & {
    when: "schedule";
    schedule: `${Minute} ${Hour} ${DayOfMonth} ${Month} ${DayOfWeek}`;
  };

export type DeployConfigCloudRunJobNormal = DeployConfigCloudRunJobBase & {
  when: "manual" | "preDeploy" | "postDeploy";
};

export type DeployConfigCloudRunJob =
  | DeployConfigCloudRunJobNormal
  | DeployConfigCloudRunJobWithSchedule;

export type DeployConfigCloudRun = {
  /**
   * EXPERIMENTAL cloud run deployment.
   *
   * This will deploy a cloud run service.
   *
   * Requires that cloud run is enabled on the project, as well as cloud run api and artifacts registry.
   */
  type: "google-cloudrun";
  /**
   * the google cloud porject id
   */
  projectId: string;
  /**
   * the region. Set to europe-west6 for switzerland
   */
  region: Gcloudregion;

  /**
   * whether to enable the service, defaults to true
   */
  service?: boolean | DeployConfigCloudRunService;

  /**
   * deploy additional services with different entry pointss
   */
  additionalServices?: {
    [name: string]: DeployConfigCloudRunService;
  };

  jobs?: {
    [name: string]: DeployConfigCloudRunJob | false | null;
  };

  /**
   * add cloudSql
   */
  cloudSql?: DeployConfigCloudRunCloudSql | false;
} & DeployConfigBase;
