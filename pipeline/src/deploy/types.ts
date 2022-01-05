// eslint-disable-next-line @typescript-eslint/ban-types
export type DeployConfigBase = {};
export type DeployConfigKubernetes = {
  type: "kubernetes";
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

export type DeployConfig = DeployConfigKubernetes;

export const isOfType = <T extends DeployConfig["type"]>(
  t: DeployConfig,
  type: T
): t is Extract<DeployConfig, { type: T }> => {
  return t.type === type;
};
