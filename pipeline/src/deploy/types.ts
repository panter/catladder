// eslint-disable-next-line @typescript-eslint/ban-types
export type DeployConfigBase = {};
export type DeployConfigKubernetes = {
  type: "kubernetes";
  cluster?: string;
  additionalHelmArgs?: string[];
  values?: {
    application?: {
      resources?: {
        limits?: {
          cpu?: any;
        };
        requests?: {
          cpu?: any;
        };
      };
    } & Record<string, any>;
  } & Record<string, any>;
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
