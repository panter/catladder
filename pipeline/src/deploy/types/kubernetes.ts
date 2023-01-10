import type { AllowUnknownProps, DeployConfigBase } from "./base";

export type DeployConfigKubernetesClusterGCloud = {
  type: "gcloud";
  /**
   * gcoud name of the cluster
   */
  name: string;
  /**
   * google cloud project id
   */
  projectId: string;
  /**
   * region
   */
  region: string;
  /**
   * domain of the cluster, for canonical domains without custom host (e.g. review and dev apps)
   */
  domainCanonical?: string;
};
export type DeployConfigKubernetesCluster = DeployConfigKubernetesClusterGCloud; // currently only this

export type KubernetesAutoscaleMetricResourceTarget =
  | {
      type: "Utilization";
      averageUtilization: number;
    }
  | {
      type: "AverageValue";
      averageValue: number | string;
    };
export type KubernetesAutoscaleMetric = {
  type: "Resource";
  resource: {
    name: "cpu" | "memory";
    target: KubernetesAutoscaleMetricResourceTarget;
  };
};
export type KubernetesAutoscale = {
  minReplicas: number;
  maxReplicas: number;
  /**
   * declare a number of metrics (at least one). Usually you would use cpu as a metric
   */
  metrics: KubernetesAutoscaleMetric[];
};
export type KubernetesResourcesDef = {
  limits?: {
    cpu?: string;
    memory?: string;
  };
  requests?: {
    cpu?: string;
    memory?: string;
  };
};
type KubernetesHealthDef = {
  httpGet?: {
    path?: string;
    port?: number;
    httpHeaders?: {
      name: string;
      value: string;
    }[];
    failureThreshold?: number;
    timeoutSeconds?: number;
    periodSeconds?: number;
    successThreshold?: number;
  };
};
export type KubernetesUpdateStrategy = {
  rollingUpdate: {
    /**
     * how many pods can be created additionally to the target number
     * can be absolute number or percentage.
     * defaults to 1 (kube default is 25%)
     */
    maxSurge: number | string;
    /**
     * how many pods are allowed to be unavailable
     * can be absolute number or percentage
     * defaults to 0 (kube default is 25%)
     */
    maxUnavailable: number | string;
  };
  type: "RollingUpdate";
};
export type KubernetesWorkerDef = {
  enabled: boolean;
  /**
   * which command to run. defaults to `yarn start`
   */
  command?: string;
  resources?: KubernetesResourcesDef;
  service?: {
    enabled?: boolean;
  };
};

export type DeployConfigMongodbBase = {
  enabled?: boolean;
  dbName?: string;
  persistence?: {
    /**
     * set premium-rwo for ssd
     */
    storageClass?: "standard-rwo" | "premium-rwo";

    /**
     * size of the volume, defaults to 8Gi
     */
    size?: string;
  };
  resources?: KubernetesResourcesDef;
};

export type DeployConfigMongodbStandalone = {
  architecture: "standalone";
};
export type DeployConfigMongodbReplicaset = {
  architecture: "replicaset";
  /**
   * defaults to 2
   */
  replicaCount?: number;
};
export type DeployConfigMongodb = DeployConfigMongodbBase &
  (DeployConfigMongodbStandalone | DeployConfigMongodbReplicaset);

export type DeployConfigKubernetesValues = AllowUnknownProps<{
  /**
   * enable cloudsql db. Currently you have to manually set it up
   */
  cloudsql?: {
    enabled: boolean;
    instanceId?: string;
    projectId?: string;
    region?: string;
  };
  /**
   * enable mongodb. The mongodb is deployed using a helm chart.
   * See https://github.com/bitnami/charts/tree/master/bitnami/mongodb
   */
  mongodb?: DeployConfigMongodb;
  /**
   * enable mailhog. Mailhog is a virtual mail server that catches all outgoing mailsl and show them in a mailbox.
   * This is great for development as it prevents to accidentially send out real emails and helps with debugging outgoing mails.
   *
   * It will automaticaly inject a MAIL_URL env var.
   *
   * Turn it of for production.
   */
  mailhog?: {
    enabled: boolean;
  };
  /**
   * post-install/upgrade jobs. These use the app image and have all env vars available.
   * Typically used for migrations and seeds
   */
  jobs?: Record<
    string,
    AllowUnknownProps<{
      /**
       * the command to execute
       */
      command: string;
      /**
       * comma-separated list of helm hooks, see https://helm.sh/docs/topics/charts_hooks/
       *
       * defaults to post-install,post-upgrade
       */
      hook?: string;
    }>
  >;
  /**
   * cronjobs that run periodically. These use the app image have all env vars available.
   */
  cronjobs?: Record<
    string,
    AllowUnknownProps<{
      schedule: string;
      command: string;
      concurrencyPolicy?: "Forbid" | "Allow" | "Replace";
    }>
  >;
  /**
   * configuration for the application ("Deployment" in kubernetes)
   */
  application?:
    | false
    | AllowUnknownProps<{
        /**
         * enable, disable app deployment, defaults to true
         */
        enabled?: boolean;
        /**
         * redirects
         */
        redirects?: AllowUnknownProps<{ host: string }>[];
        /**
         * Host aliases
         */
        hostAliases?: string[];
        /**
         * how many pods will be started
         */
        replicas?: number;

        /**
         * autoscale the pods horizontally
         */
        autoscale?: KubernetesAutoscale;

        /**
         * the update strategy, see https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-update-deployment
         */
        updateStrategy?: KubernetesUpdateStrategy;

        /**
         * kubernetes resources
         */

        resources?: KubernetesResourcesDef;
        healthRoute?: string;
        startupProbe?: KubernetesHealthDef;
        readinessProbe?: KubernetesHealthDef;
        livenessProbe?: KubernetesHealthDef;
        /**
         * specify a worker. A worker is a separate deployment that runs continously in the background.
         * The worker pod can use the same entry point as the app or a different one (specify command).
         * It has the same environment variables as the application and an additional IS_WORKER="true" variable
         */
        worker?: KubernetesWorkerDef;
      }>;

  /**
   * load secrets from other components.
   * Use this only in cases where the secret is not known on pipeline-time
   * and only if the component is also in the same cluster.
   *
   * a typical case is reusing mongo_url from other component
   *
   * also make sure that the other component deploys first
   *
   * in all other cases use normal env var handling
   */
  secretsFromOtherComponent?: {
    [envVar: string]: string;
  };

  /**
   * map another services internal endpoint into a env var.
   */
  mapServiceUrlToEnv?: {
    [envVar: string]: string;
  };
  /**
   * Mount secrets as files in the filesystem.
   * These secrets are still available as env vars, but will contain the path of the file instead
   *
   * @deprecated this will be removed in the future, because its very niche and not used
   */
  secretsAsFile?: string[];
}>;

export type DeployConfigKubernetes = {
  type: "kubernetes";
  /**
   * cluster config to use.
   */
  cluster: DeployConfigKubernetesCluster;
  /**
   * prints out debug info (helm --debug)
   */
  debug?: boolean;
  additionalHelmArgs?: string[];
  /**
   * values to configure the app
   */
  values?: DeployConfigKubernetesValues;
} & DeployConfigBase;
