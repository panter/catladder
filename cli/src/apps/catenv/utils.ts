import type { Config } from "@catladder/pipeline";
import { join } from "path";
import { getGitRoot } from "../../utils/projects";
import type { Choice } from "./types";
import { escapeForDotEnv } from "@catladder/pipeline";
export const getComponentFullPath = (
  gitRoot: string,
  config: Config,
  componentName: string,
) => {
  return join(gitRoot, config.components[componentName].dir);
};
const getCurrentComponentName = async (config: Config) => {
  const gitRoot = await getGitRoot();
  const currentDir = process.cwd();
  return Object.keys(config.components).find((c) =>
    currentDir.startsWith(getComponentFullPath(gitRoot, config, c)),
  );
};

export const getCurrentComponentAndEnvFromChoice = async (
  config: Config,
  choice?: Choice,
) => {
  const env = choice?.env ?? "local";
  const currentComponent =
    choice?.componentName ?? (await getCurrentComponentName(config));

  return {
    currentComponent,
    env,
  };
};

export const makeKeyValueString = (
  variables: Record<string, string>,
  keyPrefix = "",
) =>
  Object.entries(variables)
    // quotes are important, otherwise line breaks don't work properly
    .map(([key, value]) => `${keyPrefix}${key}=${escapeForDotEnv(value)}`)
    .join("\n");

export const sanitizeEnvVarName = (name: string) =>
  name.replace(/[\s\-.]+/g, "_");
