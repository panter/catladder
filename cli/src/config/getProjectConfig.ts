import {
  readConfigSync,
  getAllEnvs,
  getEnvironment as _getEnvironment,
  createContext,
} from "@catladder/pipeline";

import { CommandInstance } from "vorpal";
import { getAllVariables } from "../utils/gitlab";

// currently cant change
const projectConfig = readConfigSync();

export const getProjectConfig = () => {
  return projectConfig;
};

export const getProjectComponents = () => {
  const config = getProjectConfig();
  return Object.keys(config.components);
};

export const getEnvComponentChoices = () => {
  const config = getProjectConfig();
  return Object.keys(config.components).reduce<string[]>(
    (acc, componentName) => [
      ...acc,
      ...getAllEnvs(config, componentName).map((e) => e + ":" + componentName),
    ],
    []
  );
};

export const parseChoice = (envComponent: string) => {
  const [env, componentName] = envComponent.split(":");
  return { env, componentName };
};

export const getPipelineContextByChoice = (envComponent: string) => {
  const { env, componentName } = parseChoice(envComponent);
  const config = getProjectConfig();
  return createContext(config, componentName, env);
};

export const getAllPipelineContexts = () => {
  const envComponents = getEnvComponentChoices();
  return envComponents.map(getPipelineContextByChoice);
};

export const getEnvironmentByChoice = (envComponent: string) => {
  const { env, componentName } = parseChoice(envComponent);
  const config = getProjectConfig();
  return _getEnvironment(config, componentName, env);
};

const resolveSecrets = async (
  vorpal: CommandInstance,
  allEnvVars: Record<string, string>,
  secretEnvVarKeys: string[]
) => {
  const allVariablesInGitlab = await getAllVariables(vorpal);
  console.log("resolveSecrets", { allVariablesInGitlab, allEnvVars });
  return Object.fromEntries(
    Object.entries(allEnvVars).map(([key, value]) => {
      const isSecret = secretEnvVarKeys.includes(key);
      console.log({ key, value, isSecret, allVariablesInGitlab });
      if (isSecret) {
        // secrets have CL_XXXX structure
        const found = allVariablesInGitlab.find((v) => "$" + v.key === value);
        console.log({ found });
        if (found) {
          return [key, found.value];
        } else {
          return [key, ""];
        }
      }
      return [key, value];
    })
  );
};

export const getEnvVars = async (
  vorpal: CommandInstance,
  envComponent: string
) => {
  const envionment = getEnvironmentByChoice(envComponent);
  return resolveSecrets(
    vorpal,
    envionment.envVars,
    envionment.secretEnvVarKeys
  );
};
