import type { Config } from "@catladder/pipeline";
import { join } from "path";
import { getGitRoot } from "../../utils/projects";
import type { Choice, Variables } from "./types";
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

export const makeKeyValueString = (variables: Variables, keyPrefix = "") =>
  Object.entries(variables)
    .map(([key, value]) => `${keyPrefix}${key}='${value}'`)
    .join("\n");

export const sanitizeMultiLine = (variables: Variables) => {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [
      key,
      value.replaceAll("\n", "\\n"),
    ]),
  );
};

export const sanitizeEnvVarName = (name: string) =>
  name.replace(/[\s\-.]+/g, "_");
