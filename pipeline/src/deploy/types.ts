// eslint-disable-next-line @typescript-eslint/ban-types
export type DeployConfigBase = {};
type AllowUnknownProps<T extends Record<string, unknown>> = T &
  Record<string, unknown>;
export type DeployConfigKubernetes = {
  type: "kubernetes";
  cluster?: string;
  additionalHelmArgs?: string[];
  values?: AllowUnknownProps<{
    cloudsql?: {
      enabled: boolean;
    };
    jobs?: Record<string, AllowUnknownProps<{ command: string }>>;
    cronjobs?: Record<
      string,
      AllowUnknownProps<{
        schedule: string;
        command: string;
        concurrencyPolicy?: "Forbid" | "Allow" | "Replace";
      }>
    >;
    application?: AllowUnknownProps<{
      redirects: AllowUnknownProps<{ host: string }>[];
      replicas?: number;
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
    }>;
  }>;
} & DeployConfigBase;

type CustomDeployConfig = {
  type: "custom";
  script: string[];
};

export type DeployConfig = DeployConfigKubernetes;

export const isOfDeployType = <T extends DeployConfig["type"]>(
  t: DeployConfig | false,
  type: T
): t is Extract<DeployConfig, { type: T }> => {
  return t && t.type === type;
};
