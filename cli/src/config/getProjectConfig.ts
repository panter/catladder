import type { Config, EnvironmentEnvVars } from "@catladder/pipeline";
import {
  readConfigSync,
  getAllEnvs,
  getEnvironment as _getEnvironment,
  createContext,
  getSecretVarName,
} from "@catladder/pipeline";

import type { CommandInstance } from "vorpal";
import { getAllVariables, getVariableValueByRawName } from "../utils/gitlab";

import { getGitRoot } from "../utils/projects";
import { readYaml } from "../utils/files";
import { watch } from "fs";

export { parseChoice } from "./parseChoice";

let currentConfig: Config | null = null;

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
  return currentConfig as Config;
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

export const getPipelineContextByChoice = async (
  env: string,
  componentName: string
) => {
  const config = await getProjectConfig();
  return await createContext(config, componentName, env);
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
  vorpal: CommandInstance | null,
  varSets: EnvironmentEnvVars[]
): Promise<Record<string, string>> => {
  const allVariablesInGitlab = await getAllVariables(vorpal);

  return Object.fromEntries(
    varSets.flatMap((set) =>
      Object.entries(set.envVars)
        .map(([key, value]) => {
          const secretKey = set.secretEnvVarKeys.find((k) => k.key === key);

          if (secretKey) {
            if (secretKey.hidden) {
              return null;
            }
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
        .filter(Boolean)
    )
  );
};

export const getEnvVarsResolved = async (
  vorpal: CommandInstance | null,
  env: string,
  componentName: string | null
) => {
  if (!componentName) {
    return {};
  }
  try {
    const envionment = await getEnvironment(env, componentName);

    // in the pipeline the secrets alreadyy exists  and bash will expand them
    // but here we need to manually load them
    return resolveSecrets(vorpal, [
      {
        envVars: envionment.envVars,
        secretEnvVarKeys: envionment.secretEnvVarKeys,
      },
    ]);
  } catch (e) {
    // env is disabled
    return {};
  }
};

/**
 *
 * is used to get job only vars that should also be editable locally with catladder.
 */
export const getJobOnlyEnvVarsResolved = async (
  vorpal: CommandInstance,
  env: string,
  componentName: string
) => {
  try {
    const envionment = await getEnvironment(env, componentName);
    return resolveSecrets(vorpal, [
      envionment.jobOnlyVars.build,
      envionment.jobOnlyVars.deploy,
    ]);
  } catch (e) {
    // env is disabled
    return {};
  }
};
