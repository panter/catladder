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

import type { IO } from "../core/types";
import { getVariableValueByRawName } from "../utils/gitlab";

import { getGitRoot } from "../utils/projects";

export { parseChoice } from "./parseChoice";

let currentConfig: Config | null = null;

const loadConfig = async () => {
  const gitRoot = await getGitRoot();
  if (!gitRoot) {
    return;
  }
  const result = await readConfig(gitRoot);
  if (!result) {
    return;
  }
  currentConfig = result.config;
};

export const getProjectConfig = async () => {
  if (!currentConfig) {
    await loadConfig();
  }
  return currentConfig as Config;
};

/**
 * drops the cached config so the next access re-reads it from disk —
 * needed after writing the catladder store, which is attached to the
 * config (`config.store`) at read time
 */
export const invalidateProjectConfig = () => {
  currentConfig = null;
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
  return getAllComponentsWithAllEnvsFlatFromConfig(config);
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

export const getAllPipelineContexts = async (
  onlyComponent?: string | string[],
  { includeLocal = false }: { includeLocal?: boolean } = {},
) => {
  const onlyComponentsArray = onlyComponent
    ? Array.isArray(onlyComponent)
      ? onlyComponent
      : [onlyComponent]
    : null;
  return Promise.all(
    (await getAllComponentsWithAllEnvsFlat())
      .filter((c) => includeLocal || c.env !== "local")
      .filter(
        (c) =>
          !onlyComponentsArray || onlyComponentsArray.includes(c.componentName),
      )
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
  io: IO,
  env: string,
  componentName: string,
  variableName: string,
) => {
  const rawVariableName = getSecretVarName(env, componentName, variableName);
  return await getVariableValueByRawName(io, rawVariableName);
};

const resolveSecrets = async (
  io: IO,
  varSets: EnvironmentEnvVars[],
): Promise<Record<string, string>> => {
  // the secret variables actually referenced by the env var values —
  // when they are all in the local cache, the vault is not contacted
  const referencedNames = [
    ...new Set(
      varSets.flatMap(({ envVars }) =>
        Object.values(envVars).flatMap(
          (value) => `${value}`.match(/\$CL_\w+/g) ?? [],
        ),
      ),
    ),
  ].map((reference) => reference.slice(1));

  const vaultManager = await io.getVaultManager();
  const secrets = await vaultManager.readSecrets(referencedNames, io);
  const secretEntries = Object.entries(secrets);

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
          secretEntries.reduce(
            (acc, [name, secretValue]) =>
              acc.replace(new RegExp("\\$" + name, "g"), secretValue),
            `${value}`,
          ),
        ]),
    ),
  );
};

export const getEnvVarsResolved = async (
  io: IO,
  env: string,
  componentName: string | null,
) => {
  if (!componentName) {
    return {};
  }

  const envionment = await getEnvironment(env, componentName);

  // in the pipeline the secrets alreadyy exists  and bash will expand them
  // but here we need to manually load them
  return resolveSecrets(io, [
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
  io: IO,
  env: string,
  componentName: string,
) => {
  const envionment = await getEnvironment(env, componentName);
  return resolveSecrets(io, [
    envionment.jobOnlyVars.build,
    envionment.jobOnlyVars.deploy,
  ]);
};
function getAllComponentsWithAllEnvsFlatFromConfig(
  config: Config,
): { env: string; componentName: string }[] {
  return Object.keys(config.components).flatMap((componentName) =>
    getAllEnvs(config, componentName).map((env) => ({ env, componentName })),
  );
}
