// eslint-disable-next-line @typescript-eslint/ban-types
export type DeployConfigBase = {
  /**
   * whether to deploy automatically or manual. If not defined, these rules apply:
   * - prod: manual
   * - all other envs: auto
   */
  when?: "manual" | "auto";
};
type AllowUnknownProps<T extends Record<string, unknown>> = T &
  Record<string, unknown>;

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
   * Consider using external services instead of this.
   */
  mongodb?: AllowUnknownProps<{
    enabled: boolean;
  }>;
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
  jobs?: Record<string, AllowUnknownProps<{ command: string }>>;
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
  application?: AllowUnknownProps<{
    /**
     * redirects
     */
    redirects?: AllowUnknownProps<{ host: string }>[];
    /**
     * how many pods will be started
     */
    replicas?: number;

    /**
     * autoscale the pods horizontally
     */
    autoscale?: KubernetesAutoscale;
    /**
     * kubernetes resources
     */
    resources?: {
      limits?: {
        cpu?: string;
        memory?: string;
      };
      requests?: {
        cpu?: string;
        memory?: string;
      };
    };
    healthRoute?: string;
    startupProbe?: KubernetesHealthDef;
    readinessProbe?: KubernetesHealthDef;
    livenessProbe?: KubernetesHealthDef;
  }>;
  /**
   * Mount secrets as files in the filesystem.
   * These secrets are still available as env vars, but will contain the path of the file instead
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

type DeployConfigCustom = {
  type: "custom";
  requiresDocker: boolean;
  script: string[];
  stopScript?: string[];
} & DeployConfigBase;

export type DeployConfig = DeployConfigKubernetes | DeployConfigCustom;

export const isOfDeployType = <T extends Array<DeployConfig["type"]>>(
  t: DeployConfig | false,
  ...types: T
): t is Extract<DeployConfig, { type: T[number] }> => {
  return t && types.includes(t.type);
};
