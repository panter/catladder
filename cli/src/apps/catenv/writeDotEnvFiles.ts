import { writeGeneratedFile, type Config } from "@catladder/pipeline";
import { writeFile } from "fs-extra";
import { join } from "path";
import { getEnvVarsResolved } from "../../config/getProjectConfig";
import { getGitRoot } from "../../utils/projects";
import type { Choice } from "./types";
import {
  getComponentFullPath,
  getCurrentComponentAndEnvFromChoice,
  makeKeyValueString,
  sanitizeMultiLine,
} from "./utils";

export const writeDotEnvFiles = async (config: Config, choice?: Choice) => {
  const { env, currentComponent } = await getCurrentComponentAndEnvFromChoice(
    config,
    choice,
  );

  const componentsWithEnabledDotEnvWrite = Object.entries(config.components)
    .filter(([, component]) => component?.dotEnv ?? true) // when set to true or "local"
    .map(([componentName]) => componentName);

  const componentsToActuallyWriteDotEnvNow = currentComponent
    ? componentsWithEnabledDotEnvWrite.includes(currentComponent)
      ? [currentComponent]
      : []
    : componentsWithEnabledDotEnvWrite;
  const gitRoot = await getGitRoot();

  for (const componentName of componentsToActuallyWriteDotEnvNow) {
    const variables = await getEnvVarsResolved(null, env, componentName);
    delete variables["_ALL_ENV_VAR_KEYS"];
    const componentDir = getComponentFullPath(gitRoot, config, componentName);
    const filePath = join(componentDir, ".env");
    // many .dotenv don't like multiline values, so we sanitize them here
    const variablesSanitized = sanitizeMultiLine(variables);
    await writeGeneratedFile(filePath, makeKeyValueString(variablesSanitized), {
      commentChar: "#",
    });
  }
};
