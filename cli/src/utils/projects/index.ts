import { exec } from "child-process-promise";
import { join } from "path";
import k8sApi from "../../k8sApi";
import { Env, ISecrets, IValueFile } from "../../types/types";
import { readFileOrError, readYaml } from "../files";
import formatEnvVars from "../formatEnvVars";
import { hasBitwarden, readPassEnvVars, syncBitwarden } from "../passwordstore";
import { filter } from "../promise";

import { merge } from "lodash";

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
export const getLocalProjectVariables = async () => {
  const [error, file] = await readRootGitlabCiFile();
  if (error) {
    throw new Error("there is no '.gitlab-ci.yml' in the current project");
  }
  // yawn allows to modify yaml while keeping comments!
  const yawn = new YAWN(file);
  const { variables } = yawn.json;
  if (!variables) {
    throw new Error("your '.gitlab-ci.yml' does not define `variables`");
  }
  const defaults = {
    CLUSTER_NAME: "production",
  };
  return {
    ...defaults,
    ...variables,
  };
};

export const getProjectNamespace = async (env: Env) => {
  const { CUSTOMER_NAME, APP_NAME } = await getLocalProjectVariables();
  return `${CUSTOMER_NAME}-${APP_NAME}-${env}`;
};

export const getProjectHelmReleaseName = async (env: Env) => {
  // can't properly get the release name for review as it contains an additional branch slug
  if (env === "review" || env === "dev-local") {
    throw new Error(`can't get helm release name for ${env}`);
  }
  const {
    CUSTOMER_NAME,
    APP_NAME,
    COMPONENT_NAME = "web",
  } = await getLocalProjectVariables();
  return `${CUSTOMER_NAME}-${APP_NAME}-${env}-${COMPONENT_NAME}`;
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
  return {
    ...(await getAllPublicEnvVars(env, subApp)),
    ...(await getAllSecretEnvVars(env, subApp)),
  };
};

export const getAllSecretEnvVars = async (env: Env, subApp?: string) => {
  if (!(await hasSecrets(env, subApp))) {
    return {};
  }
  if (await hasBitwarden()) {
    await syncBitwarden(false /* do not force sync */);
    const passPath = await getPassPath(env);
    return readPassEnvVars(passPath);
  } else {
    return {};
  }
};
