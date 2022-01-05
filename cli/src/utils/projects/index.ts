import { exec } from "child-process-promise";
import { join } from "path";
import k8sApi from "../../k8sApi";
import { Env, ISecrets, IValueFile } from "../../types/types";
import { readFileOrError, readYaml } from "../files";
import formatEnvVars from "../formatEnvVars";
import { hasBitwarden, readPassEnvVars, syncBitwarden } from "../passwordstore";
import { filter } from "../promise";

import { merge } from "lodash";
import { getProjectConfig } from "../../config/getProjectConfig";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const YAWN = require("yawn-yaml/cjs");

export const getGitRoot = async () => {
  return (await exec("git rev-parse --show-toplevel")).stdout?.trim();
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

export const getProjectNamespace = async (env: string) => {
  const config = getProjectConfig();
  return `${config.customerName}-${config.appName}-${env}`;
};

export const getProjectPods = async (env: Env) => {
  const namespace = await getProjectNamespace(env);
  const res = await k8sApi.listNamespacedPod(namespace);

  return res.body.items;
};

export const getProjectPvcs = async (env: Env) => {
  const namespace = await getProjectNamespace(env);
  const res = await k8sApi.listNamespacedPersistentVolumeClaim(namespace);

  return res.body.items;
};

export const getProjectPodNames = async (env: Env) => {
  const pods = await getProjectPods(env);
  return pods.map((n) => n.metadata.name);
};

export const getPassPath = async (env: Env) => {
  const { CUSTOMER_NAME, APP_NAME } = await getLocalProjectVariables();
  return `${CUSTOMER_NAME}/${APP_NAME}/${env}/secrets.yml`;
};

export const getProjectValuesFiles = async (env: Env, subApp?: string) => {
  const gitRoot = await getGitRoot();
  const possibleFiles = ["values.yml", `values-${env}.yml`].map((file) =>
    subApp ? join(gitRoot, subApp, file) : join(gitRoot, file)
  );
  return filter(possibleFiles, async (file) => {
    const [error] = await readFileOrError(file);
    return !error;
  });
};

export const getAllValues = async (env: Env, subApp?: string) => {
  const valuesFilePaths = await getProjectValuesFiles(env, subApp);
  return Promise.all(
    valuesFilePaths.map(async (file) => (await readYaml(file)) as IValueFile)
  );
};

export const getProjectValues = async (env: Env, subApp?: string) => {
  const values = await getAllValues(env, subApp);
  return merge({}, ...values) as IValueFile;
};

export const getAllPublicEnvVars = async (env: Env, subApp?: string) => {
  return formatEnvVars(
    (await getAllValues(env, subApp)).reduce<ISecrets>((acc, value) => {
      if (value.env && value.env.public) {
        return {
          ...acc,
          ...value.env.public,
        };
      }
      return acc;
    }, {})
  );
};
export const getAllSecretsEnvVarsMapping = async (
  env: Env,
  subApp?: string
) => {
  return (await getAllValues(env, subApp)).reduce<ISecrets>((acc, value) => {
    if (value.env && value.env.secret) {
      return {
        ...acc,
        ...value.env.secret,
      };
    }
    return acc;
  }, {});
};

export const hasSecrets = async (env: Env, subApp?: string) => {
  return Object.keys(await getAllSecretsEnvVarsMapping(env, subApp)).length > 0;
};

export const getAllEnvVars = async (
  env: Env,
  subApp?: string
): Promise<Record<string, string>> => {
  throw new Error("needs to be re-implemented");
};

export const getAllSecretEnvVars = async (env: Env, subApp?: string) => {
  throw new Error("needs to be re-implemented");
};

export const getLocalProjectVariables = () => {
  throw new Error("use getProjectConfig");
};
