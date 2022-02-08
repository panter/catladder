import { $ } from "zx";
import { join } from "path";
import { getProjectConfig, parseChoice } from "../../config/getProjectConfig";
import k8sApi from "../../k8sApi";
import { readFileOrError } from "../files";

export const getGitRoot = async (): Promise<string> => {
  return (await $`git rev-parse --show-toplevel`).stdout.trim();
};

export const getRootGitlabCiFile = async () => {
  const gitRoot = await getGitRoot();
  return join(gitRoot, ".gitlab-ci.yml");
};

export const readRootGitlabCiFile = async () =>
  readFileOrError(await getRootGitlabCiFile());

export const hasGitlabCiFile = async () => {
  const [error, file] = await readRootGitlabCiFile();
  if (error) {
    return false;
  }
  return true;
};

export const getProjectNamespace = async (envComponent: string) => {
  const { env } = parseChoice(envComponent);
  const config = await getProjectConfig();
  return `${config.customerName}-${config.appName}-${env}`;
};

export const getProjectPods = async (envComponent: string) => {
  const namespace = await getProjectNamespace(envComponent);
  const res = await k8sApi.listNamespacedPod(namespace);

  return res.body.items;
};

export const getProjectPvcs = async (envComponent: string) => {
  const namespace = await getProjectNamespace(envComponent);
  const res = await k8sApi.listNamespacedPersistentVolumeClaim(namespace);

  return res.body.items;
};

export const getProjectPodNames = async (envComponent: string) => {
  const pods = await getProjectPods(envComponent);
  return pods.map((n) => n.metadata.name);
};
