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
      instanceId?: string;
      projectId?: string;
      region?: string;
    };
    mongodb?: AllowUnknownProps<{
      enabled: boolean;
    }>;
    mailhog?: {
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
      redirects?: AllowUnknownProps<{ host: string }>[];
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

export const isOfDeployType = <T extends Array<DeployConfig["type"]>>(
  t: DeployConfig | false,
  ...types: T
): t is Extract<DeployConfig, { type: T[number] }> => {
  return t && types.includes(t.type);
};
