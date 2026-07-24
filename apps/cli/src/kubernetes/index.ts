import { parseChoice } from "../config/parseChoice";
import { getk8sApi } from "../k8sApi";
import { getProjectNamespace } from "../utils/projects";

export const getProjectPods = async (envComponent: string) => {
  const namespace = await getProjectNamespace(envComponent);
  const k8sApi = getk8sApi();
  const res = await k8sApi.listNamespacedPod(namespace);

  const { componentName } = parseChoice(envComponent);
  return res.body.items.filter((item) =>
    componentName ? item.metadata?.name?.includes(componentName + "-") : true,
  );
};

export const getProjectPvcs = async (envComponent: string) => {
  const namespace = await getProjectNamespace(envComponent);
  const k8sApi = getk8sApi();
  const res = await k8sApi.listNamespacedPersistentVolumeClaim(namespace);

  return res.body.items;
};

export const getProjectPodNames = async (envComponent: string) => {
  const pods = await getProjectPods(envComponent);
  return pods.map((n) => n.metadata.name);
};
