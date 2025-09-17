import { join } from "path";
import { getEnvVarsResolved } from "../../config/getProjectConfig";
import { getGitRoot } from "../../utils/projects";
import type { Choice } from "./types";
import {
  getComponentFullPath,
  getCurrentComponentAndEnvFromChoice,
  makeKeyValueString,
} from "./utils";
import type { CatenvContext } from "@catladder/pipeline";

export const writeDotEnvFiles = async (
  context: CatenvContext,
  choice?: Choice,
) => {
  const { env, currentComponent } = await getCurrentComponentAndEnvFromChoice(
    context.config,
    choice,
  );

  const componentsWithEnabledDotEnvWrite = Object.entries(
    context.config.components,
  )
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
    const componentDir = getComponentFullPath(
      gitRoot,
      context.config,
      componentName,
    );
    const filePath = join(componentDir, ".env");

    await context.fileWriter.writeGeneratedFile(
      filePath,
      makeKeyValueString(variables),
      {
        commentChar: "#",
      },
    );
  }
};
