import type {
  Config,
  EnvironmentEnvVars,
  VariableValue,
} from "@catladder/pipeline";
import {
  readConfig,
  getAllEnvs,
  getEnvironment as _getEnvironment,
  createComponentContext,
  getSecretVarName,
} from "@catladder/pipeline";

import type { CommandInstance } from "vorpal";
import { getAllVariables, getVariableValueByRawName } from "../utils/gitlab";

import { getGitRoot } from "../utils/projects";

import { watch } from "fs";

export { parseChoice } from "./parseChoice";

let currentConfig: Config | null = null;

// reload the config on change
const reloadConfigAndObserve = async () => {
  const gitRoot = await getGitRoot();
  if (!gitRoot) {
    return;
  }
  const result = await readConfig(gitRoot);
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

export const getProjectComponents = async () => {
  const config = await getProjectConfig();
  if (!config) return [];
  return Object.keys(config.components);
};

export const getPipelineContextByChoice = async (
  env: string,
  componentName: string,
) => {
  const config = await getProjectConfig();
  return await createComponentContext({
    config,
    componentName,
    env,
  });
};
export const getAllComponentsWithAllEnvsFlat = async (): Promise<
  Array<{ env: string; componentName: string }>
> => {
  const config = await getProjectConfig();
  if (!config) {
    return [];
  }
  return Object.keys(config.components).flatMap((componentName) =>
    getAllEnvs(config, componentName).map((env) => ({ env, componentName })),
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
    ]),
  );
};

export const getAllPipelineContexts = async () => {
  return Promise.all(
    (await getAllComponentsWithAllEnvsFlat())
      .filter((c) => c.env !== "local")
      .map(({ env, componentName }) =>
        getPipelineContextByChoice(env, componentName),
      ),
  );
};

export const getEnvironment = async (env: string, componentName: string) => {
  const config = await getProjectConfig();

  return _getEnvironment({ config, componentName, env });
};

export const getGitlabVar = async (
  vorpal: CommandInstance,
  env: string,
  componentName: string,
  variableName: string,
) => {
  const rawVariableName = getSecretVarName(env, componentName, variableName);
  return await getVariableValueByRawName(vorpal, rawVariableName);
};

const resolveSecrets = async (
  vorpal: CommandInstance | null,
  varSets: EnvironmentEnvVars[],
): Promise<Record<string, string>> => {
  const allVariablesInGitlab = await getAllVariables(vorpal);

  return Object.fromEntries(
    varSets.flatMap(({ envVars, secretEnvVarKeys }) =>
      Object.entries(envVars)
        .filter(
          ([key, value]) =>
            value !== undefined &&
            value !== null &&
            !secretEnvVarKeys.find((k) => k.key === key)?.hidden,
        )
        .map(([key, value]) => [
          key,
          allVariablesInGitlab.reduce(
            (acc, curr) =>
              acc.replace(new RegExp("\\$" + curr.key, "g"), curr.value),
            `${value}`,
          ),
        ]),
    ),
  );
};

export const getEnvVarsResolved = async (
  vorpal: CommandInstance | null,
  env: string,
  componentName: string | null,
) => {
  if (!componentName) {
    return {};
  }

  const envionment = await getEnvironment(env, componentName);

  // in the pipeline the secrets alreadyy exists  and bash will expand them
  // but here we need to manually load them
  return resolveSecrets(vorpal, [
    {
      envVars: envionment.envVars,
      secretEnvVarKeys: envionment.secretEnvVarKeys,
    },
  ]);
};

/**
 *
 * is used to get job only vars that should also be editable locally with catladder.
 */
export const getJobOnlyEnvVarsResolved = async (
  vorpal: CommandInstance,
  env: string,
  componentName: string,
) => {
  const envionment = await getEnvironment(env, componentName);
  return resolveSecrets(vorpal, [
    envionment.jobOnlyVars.build,
    envionment.jobOnlyVars.deploy,
  ]);
};
