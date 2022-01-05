import {
  readConfigSync,
  getAllEnvs,
  getEnvironment as _getEnvironment,
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
      ...getAllEnvs(config, componentName).map((e) => componentName + "-" + e),
    ],
    []
  );
};

export const getEnvironmentByChoice = (envComponent: string) => {
  const [env, componentName] = envComponent.split("-");
  const config = getProjectConfig();
  return _getEnvironment(config, componentName, env);
};

export const resolveSecrets = async (
  vorpal: CommandInstance,
  variables: Record<string, any>
) => {
  const allVariablesInGitlab = await getAllVariables(vorpal);

  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => {
      // secrets have $CL_XXXX structure
      const found = allVariablesInGitlab.find((v) => v.key === key);
      if (found) {
        return [key, found.value];
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
  return resolveSecrets(vorpal, envionment.variables);
};
