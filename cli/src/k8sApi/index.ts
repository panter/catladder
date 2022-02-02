import {
  KubeConfig,
  CoreV1Api,
  BatchV1Api,
  BatchV1beta1Api,
} from "@kubernetes/client-node";

const kc = new KubeConfig();

export const reload = () => {
  kc.loadFromDefault();
};

reload();

const k8sApi = kc.makeApiClient(CoreV1Api);

export const k8sApiBatch = kc.makeApiClient(BatchV1Api);
export const k8sApiBatchBeta = kc.makeApiClient(BatchV1beta1Api);

export default k8sApi;
