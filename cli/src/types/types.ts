export type KubernetesSecretName = string;
export interface ISecrets {
  [key: string]: KubernetesSecretName;
}
export interface IValueFile {
  env?: {
    public?: {
      [key: string]: string;
    };
    secret?: ISecrets;
  };
  cloudsql?: {
    enabled: boolean;
    instanceId?: string;
    region?: string;
    projectId?: string;
  };
}
