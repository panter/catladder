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
   * timeout of the service, defaults to 5 minutes.
   *
   * you can specify something like 10m30s. if its just a number, it will be interpreted as seconds
   *
   * max supported is 60min
   */
  timeout?: string;

  /**
   *
   * set the execution environment.
   *
   * see https://cloud.google.com/run/docs/about-execution-environments
   *
   * defaults to gen1 according to gcloud
   */
  executionEnvironment?: "gen2" | "gen1";

  /**
   * Use http2 end-to-end. See https://cloud.google.com/run/docs/configuring/http2
   *
   * Defaults to false.
   *
   * Your service needs to be able to handle http2 requests.
   * Its recommended to use http2 without tls, since cloud run handles the encryption for you. (so called "h2c" (http2 cleartext))
   *
   */
  http2?: boolean;

  /**
   * Number of GPUs to use. Defaults to 0
   *
   * This is a preview feature and not all regions support it.
   */
  gpu?: number;

  /**
   * gpu type to use. Refer to https://cloud.google.com/run/docs/configuring/services/gpu#gcloud for defaults
   */
  gpuType?: string;

  /**
   * the image to use. Defaults to the image from the build.
   *
   * If you specify an image, you usually want to disable the build by setting build: false
   */
  image?: string;
  /**
   * args to pass to the command
   */
  args?: string[];

  /**
   * Configuration of the health check.
   *
   * When set to `true`, startup and liveness probes will be
   * configured to `defaultStartupProbe` and `defaultLivenessProbe`.
   *
   * When not set, default Cloud Run's health check
   * configuration is used (startup TCP probe and no liveness probe).
   */
  healthCheck?:
    | true
    | {
        /**
         * Startup probe configuration.
         */
        startupProbe: DeployConfigCloudRunProbe;

        /**
         * Liveness probe configuration.
         * `false` disables the liveness probe.
         */
        livenessProbe: false | DeployConfigCloudRunProbe;
      };
} & DeployConfigCloudRunWithVolumes &
  DeployConfigCloudRunNetworkConfig;

export const defaultStartupProbe: DeployConfigCloudRunProbe = {
  type: "http1",
  path: "/__health",

  initialDelaySeconds: 5,
  timeoutSeconds: 1,
  periodSeconds: 30,
  failureThreshold: 3,
};

export const defaultLivenessProbe: DeployConfigCloudRunProbe = {
  ...defaultStartupProbe,

  initialDelaySeconds: 0,
  timeoutSeconds: 10,
  periodSeconds: 30,
  failureThreshold: 3,
};

export type DeployConfigCloudRunProbe =
  | DeployConfigCloudRunHttp1Probe
  | DeployConfigCloudRunTcpProbe;

export type DeployConfigCloudRunProbeShared = {
  /**
   * The period in seconds at which to perform the probe.
   * For example 2 to perform the probe every 2 seconds.
   * Specify a value **from 1 second to 240** seconds.
   */
  periodSeconds: number;

  /**
   * The number of seconds to wait after the container has started before performing the first probe.
   * Specify a value **from 0 seconds to 240** seconds.
   */
  initialDelaySeconds: number;

  /**
   * The number of seconds to wait until the probe times out.
   * This value cannot exceed the value specified for `period`.
   * Specify a value **from 1 to 240**.
   */
  timeoutSeconds: number;

  /**
   * The number of times to retry the probe before shutting down the container.
   */
  failureThreshold: number;
};

export type DeployConfigCloudRunTcpProbe = DeployConfigCloudRunProbeShared & {
  /**
   * Cloud Run makes a TCP connection to open the TCP Socket on the specified port.
   * If Cloud Run is unable to establish a connection, it indicates a failure.
   */
  type: "tcp";
};

export type DeployConfigCloudRunHttp1Probe = DeployConfigCloudRunProbeShared & {
  /**
   * **This will NOT work with http2 enabled services**
   *
   * Cloud Run makes an HTTP GET request to the service health check endpoint (for example, /ready).
   * Any response between 200 and 400 is a success, everything else indicates failure.
   *
   * If a startup probe does not succeed within the specified time (failureThreshold * period), which cannot exceed 240 seconds, the container is shut down.
   *
   * If the HTTP startup probe succeeds within the specified time, and you have enabled liveness probe, the HTTP liveness probe is started.
   */
  type: "http1";

  /**
   * the route path to check for health status of the service starting with a `/`.
   */
  path: string;
};

export type DeployConfigCloudRunNetworkConfig = {
  /* the vpc network, see https://cloud.google.com/sdk/gcloud/reference/run/deploy#--network  */
  network?: string;

  /**
   * vpc subnet to use, see https://cloud.google.com/sdk/gcloud/reference/run/deploy#--subnet
   */
  subnet?: string;
  /**
   * vpc egress, see https://cloud.google.com/sdk/gcloud/reference/run/deploy#--vpc-egress
   */
  vpcEgress?: "all-traffic" | "private-ranges-only";

  /**
   * vpc connector
   */
  vpcConnector?: string;
};

export type DeployConfigCloudRunJobBase = {
  /**
   * command
   */
  command: string | string[];

  /**
   * optional, specify args. Those get overwritten by job executions if specified there
   */
  args?: string[];

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

  /**
   * max number of retries of the job. Defaults to 0
   */
  maxRetries?: number;
} & DeployConfigCloudRunWithVolumes &
  DeployConfigCloudRunNetworkConfig;

type Minute = string;
type Hour = string;
type DayOfMonth = string;
type DayOfWeek = string;
type Month = string;
export type DeployConfigCloudRunJobWithSchedule =
  DeployConfigCloudRunJobBase & {
    /**
     * @deprecated use `execute` instead
     */
    when: "schedule";
    /**
     * @deprecated use `run` instead
     */
    schedule: `${Minute} ${Hour} ${DayOfMonth} ${Month} ${DayOfWeek}`;
    /**
     * Max number of retries of the cloud scheduler.
     * Note: the task itself is never retried.
     *
     * defaults to 0 (no retries)
     *
     *  @deprecated use `run` instead
     */
    maxRetryAttempts?: 0 | 1 | 2 | 3 | 4 | 5;
  };

export type DeployConfigCloudRunJobNormal = DeployConfigCloudRunJobBase & {
  /**
   * wait for completion of the job on preDeploy and postDeploy
   *
   * has no effect on preStop and postStop (which always wait for completion)
   *
   *
   * @deprecated use `run` instead
   */
  waitForCompletion?: boolean;
  /**
   * @deprecated use `run` instead
   */
  when?: "manual" | "preDeploy" | "postDeploy" | "preStop" | "postStop";
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

  /**
   * execute jobs on deploy or execute jobs and http requests on a schedule
   */
  execute?: Record<string, DeployConfigCloudRunExecute | null>;

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

export type DeployConfigCloudRunExecuteJobBase = {
  /**
   * set to "job" to run a cloud run job
   */
  type: "job";
  /**
   * the cloud run job to run
   */
  job: string;

  /**
   * additional args to pass to the job
   */
  args?: string[];
};

type WithSchedule = {
  /**
   * run the job on a schedule
   */
  when: "schedule";
  /**
   * the cron schedule. See https://crontab.guru/
   */
  schedule: `${Minute} ${Hour} ${DayOfMonth} ${Month} ${DayOfWeek}`;

  /**
   * Max number of retries of the cloud scheduler.
   * Note: the task itself is never retried.
   *
   * defaults to 0 (no retries)
   */
  maxRetryAttempts?: 0 | 1 | 2 | 3 | 4 | 5;
};

export type DeployConfigCloudRunExecuteJobScheduled =
  DeployConfigCloudRunExecuteJobBase & WithSchedule;

export type DeployConfigCloudRunExecuteOnDeploy =
  DeployConfigCloudRunExecuteJobBase &
    (
      | {
          /**
           * run the job before or after the deploy
           */
          when: "preDeploy" | "postDeploy";
          /**
           * whether to wait for completion of the job
           */
          waitForCompletion?: boolean;
        }
      | {
          /**
           * run the job before or after the environment is stopped
           */
          when: "preStop" | "postStop";
        }
    );

export type DeployConfigCloudRunExecuteJob =
  | DeployConfigCloudRunExecuteJobScheduled
  | DeployConfigCloudRunExecuteOnDeploy;

export type DeployConfigCloudRunExecuteHttp = {
  /**
   * set to "http" to run a http request
   */
  type: "http";
  /**
   * the url to call
   */
  url: string;

  /**
   * the http-method to use. Defaults to "POST" (as specified by google cloud scheduler)
   */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

  /**
   * the body to send
   */
  body?: string;

  /**
   * the headers to send
   */
  headers?: Record<string, string>;
} & WithSchedule;

export type DeployConfigCloudRunExecute =
  | DeployConfigCloudRunExecuteJob
  | DeployConfigCloudRunExecuteHttp;

export type DeployConfigCloudRunExecuteWithSchedule = Extract<
  DeployConfigCloudRunExecute,
  WithSchedule
>;
