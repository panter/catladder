import {
  readConfigSync,
  getAllEnvs,
  getEnvironment as _getEnvironment,
  createContext,
} from "@catladder/pipeline";

import { CommandInstance } from "vorpal";
import { getAllVariables } from "../utils/gitlab";
import memoizee from "memoizee";
import { getGitRoot } from "../utils/projects";
import { readYaml } from "../utils/files";
// currently cant change

export const getProjectConfig = memoizee(
  async () => {
    try {
      const gitRoot = await getGitRoot();
      return readConfigSync(gitRoot);
    } catch (e) {
      // ignore
      return null;
    }
  },
  { promise: true }
);

export const reloadConfig = () => getProjectConfig.clear();

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
export const getAllComponentsWithAllEnvs = async () => {
  const config = await getProjectConfig();
  if (!config) {
    return [];
  }
  return Promise.all(
    Object.keys(config.components).flatMap((componentName) =>
      getAllEnvs(config, componentName).map((env) => ({ env, componentName }))
    )
  );
};

export const getAllPipelineContexts = async () => {
  return Promise.all(
    (await getAllComponentsWithAllEnvs())
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

const resolveSecrets = async (
  vorpal: CommandInstance,
  allEnvVars: Record<string, string>
) => {
  const allVariablesInGitlab = await getAllVariables(vorpal);

  return Object.fromEntries(
    Object.entries(allEnvVars).map(([key, value]) => {
      const isSecret = String(value)?.startsWith?.("$CL_");
      if (isSecret) {
        // secrets have CL_XXXX structure
        const found = allVariablesInGitlab.find((v) => "$" + v.key === value);

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
  env: string,
  componentName: string
) => {
  const envionment = await getEnvironment(env, componentName);

  return resolveSecrets(vorpal, envionment.envVars);
};
