import {
  KubeConfig,
  CoreV1Api,
  BatchV1Api,
  BatchV1beta1Api,
} from "@kubernetes/client-node";

const getKubeConfig = () => {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  return kc;
};
/**
 * get kubernetes client. avoid reusing the instance when context get changed
 * @returns kuberenetes client
 */
export const getk8sApi = () => {
  const kc = getKubeConfig();

  return kc.makeApiClient(CoreV1Api);
};

export const getk8sApiBatch = () => {
  const kc = getKubeConfig();

  return kc.makeApiClient(BatchV1Api);
};

export const getk8sApiBatchBeta = () => {
  const kc = getKubeConfig();

  return kc.makeApiClient(BatchV1beta1Api);
};
