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
   * format of the `DATABASE_URL` environment variable
   *
   * the options are:
   * - prisma: adds [required but ignored hostname](https://www.prisma.io/docs/orm/overview/databases/postgresql#connecting-via-sockets):
   *   `postgresql://$DB_USER:$DB_PASSWORD@localhost/$DB_NAME?host=/cloudsql/$CLOUD_SQL_INSTANCE_CONNECTION_NAME`
   * - rails: percent-encodes the socket in the host part
   *   `postgresql://$DB_USER:$DB_PASSWORD@%2Fcloudsql%2FprojectId%3Aregion%3Ainstancename/$DB_NAME?`
   * - jdbc: for use with Google Cloud SQL Connector for Java
   *   `jdbc:postgresql:///$DB_NAME?cloudSqlInstance=$CLOUD_SQL_INSTANCE_CONNECTION_NAME&socketFactory=com.google.cloud.sql.postgres.SocketFactory&user=$DB_USER&password=$DB_PASSWORD`
   *
   * defaults to prisma
   */
  dbConnectionStringFormat?: "prisma" | "rails" | "jdbc";

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
type Cpu = 1 | 2 | 4 | 6 | 8;
export type DeployConfigCloudRunService = {
  /**
   * command / entrypoint, fallsback to buildConfig.startcommand
   */
  command?: string | string[];

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
   * set to true to allways allocate cpu, e.g. for workers. Careful that this is expensive, unless you get really regularly requests!
   */
  noCpuThrottling?: true;

  /**
   * whether to allow public access without authentification (defaults to true)
   */
  allowUnauthenticated?: boolean;

  /**
   * whether to expose the service to the internet.
   *
   * The options are:
   * - all: expose to the internet and internal traffic
   * - internal: only expose to internal traffic
   * - internal-and-cloud-load-balancing: expose to internal traffic and cloud load balancing
   *
   * Defaults to "all"
   */
  ingress?: "all" | "internal" | "internal-and-cloud-load-balancing";

  /**
   * CPU limit.
   */
  cpu?: Cpu;

  /**
   * memory limit. Defaults to 512MB
   */
  memory?: Memory;

  /**
   *
   * set the execution environment.
   *
   * see https://cloud.google.com/run/docs/about-execution-environments
   *
   * defaults to gen1 according to gcloud
   */
  executionEnvironment?: "gen2" | "gen1";
} & DeployConfigCloudRunWithVolumes;

export type DeployConfigCloudRunJobBase = {
  /**
   * command
   */
  command: string | string[];

  /**
   * custom image to use. Defaults to the image from the build
   */
  image?: string;

  /**
   * CPU limit of the job.
   */
  cpu?: Cpu;

  /**
   * memory limit of the job, defaults to 512Mi
   */
  memory?: `${number}${"M" | "G" | "Mi" | "Gi"}`;

  /**
   * timeout of job, defaults to 10 minutes
   *
   * you can specify something like 10m30s
   */
  timeout?: string;

  /**
   * number of tasks that may run concurrently, defaults to 1
   */
  parallelism?: number;
} & DeployConfigCloudRunWithVolumes;

type Minute = string;
type Hour = string;
type DayOfMonth = string;
type DayOfWeek = string;
type Month = string;
export type DeployConfigCloudRunJobWithSchedule =
  DeployConfigCloudRunJobBase & {
    when: "schedule";
    schedule: `${Minute} ${Hour} ${DayOfMonth} ${Month} ${DayOfWeek}`;
    /**
     * Max number of retries of the cloud scheduler.
     * Note: the task itself is never retried.
     *
     * defaults to 0 (no retries)
     */
    maxRetryAttempts?: 0 | 1 | 2 | 3 | 4 | 5;
  };

export type DeployConfigCloudRunJobNormal = DeployConfigCloudRunJobBase & {
  when: "manual" | "preDeploy" | "postDeploy" | "preStop" | "postStop";
};

export type DeployConfigCloudRunWithVolumes = {
  /**
   * adds volumes to the service. This is an experimental feature and requires beta gcloud.
   * sets executionEnvironment to gen2 automatically, since that is required
   */
  volumes?: DeployConfigCloudRunVolumes;
};

export type DeployConfigCloudRunJob =
  | DeployConfigCloudRunJobNormal
  | DeployConfigCloudRunJobWithSchedule;

export type DeployConfigCloudRun = {
  /**
   * cloud run deployment.
   *
   * This will deploy a cloud run service. You can optionally define one-time and scheduled jobs running on cloud run
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
   * deploy additional services with different entry points.
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

  debug?: boolean;
} & DeployConfigBase;

export type DeployConfigCloudRunVolumes = Record<
  string,
  DeployConfigCloudRunVolume
>;

export type DeployConfigCloudRunVolume = {
  type: "cloud-storage";
  bucket: string;
  mountPath: string;
  readonly?: boolean;
};
