import {
  readConfigSync,
  getAllEnvs,
  getEnvironment as _getEnvironment,
  createContext,
  getSecretVarName,
  Config,
} from "@catladder/pipeline";

import { CommandInstance } from "vorpal";
import { getAllVariables, getVariableValueByRawName } from "../utils/gitlab";

import { getGitRoot } from "../utils/projects";
import { readYaml } from "../utils/files";
import { watch } from "fs";

let currentConfig: Config = null;

// reload the config on change
const reloadConfigAndObserve = async () => {
  const gitRoot = await getGitRoot();
  const result = readConfigSync(gitRoot);
  if (!result) {
    // can't do anything, there is no config
    return;
  }
  const { config, path } = result;
  const watcher = watch(path, () => {
    watcher.close();
    reloadConfigAndObserve();
  });
  currentConfig = config;
};

export const getProjectConfig = async () => {
  if (!currentConfig) {
    // initially
    await reloadConfigAndObserve();
  }
  return currentConfig;
};

export const getGitlabCiFilePath = async () => {
  const gitRoot = await getGitRoot();
  return gitRoot + "/.gitlab-ci.yml";
};
export const getGitlabCi = async <T = Record<string, any>>() => {
  try {
    return readYaml(await getGitlabCiFilePath()) as Promise<T>;
  } catch (e) {
    // ignore
    return null;
  }
};

export const getProjectComponents = async () => {
  const config = await getProjectConfig();
  if (!config) return [];
  return Object.keys(config.components);
};

export const parseChoice = (envComponent: string) => {
  const [env, componentName] = envComponent.split(":");
  return { env, componentName };
};

export const getPipelineContextByChoice = async (
  env: string,
  componentName: string
) => {
  const config = await getProjectConfig();
  return createContext(config, componentName, env);
};
export const getAllComponentsWithAllEnvsFlat = async (): Promise<
  Array<{ env: string; componentName: string }>
> => {
  const config = await getProjectConfig();
  if (!config) {
    return [];
  }
  return Object.keys(config.components).flatMap((componentName) =>
    getAllEnvs(config, componentName).map((env) => ({ env, componentName }))
  );
};

export const getAllComponentsWithAllEnvsHierarchical = async (): Promise<{
  [componentName: string]: string[];
}> => {
  const config = await getProjectConfig();
  if (!config) {
    return {};
  }

  return Object.fromEntries(
    Object.keys(config.components).map((componentName) => [
      componentName,
      getAllEnvs(config, componentName),
    ])
  );
};

export const getAllPipelineContexts = async () => {
  return Promise.all(
    (await getAllComponentsWithAllEnvsFlat())
      .filter((c) => c.env !== "local")
      .map(({ env, componentName }) =>
        getPipelineContextByChoice(env, componentName)
      )
  );
};

export const getEnvironment = async (env: string, componentName: string) => {
  const config = await getProjectConfig();

  return _getEnvironment(config, componentName, env);
};

export const getGitlabVar = async (
  vorpal: CommandInstance,
  env: string,
  componentName: string,
  variableName: string
) => {
  const rawVariableName = getSecretVarName(env, componentName, variableName);
  return await getVariableValueByRawName(vorpal, rawVariableName);
};

const resolveSecrets = async (
  vorpal: CommandInstance,
  allEnvVars: Record<string, string>
) => {
  const allVariablesInGitlab = await getAllVariables(vorpal);

  return Object.fromEntries(
    Object.entries(allEnvVars).map(([key, value]) => {
      const containsSecret = String(value)?.includes?.("$CL_");
      if (containsSecret) {
        for (const variable of allVariablesInGitlab) {
          value = value.replace(
            new RegExp("\\$" + variable.key, "g"),
            variable.value
          );
        }
        return [key, value];
      }
      return [key, value];
    })
  );
};

export const getEnvVars = async (
  vorpal: CommandInstance,
  env: string,
  componentName: string
) => {
  const envionment = await getEnvironment(env, componentName);
  // in the pipeline the secrets alreadyy exists  and bash will expand them
  // but here we need to manually load them
  return resolveSecrets(vorpal, envionment.envVars);
};
