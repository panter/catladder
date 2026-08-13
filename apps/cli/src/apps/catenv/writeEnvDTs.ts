import type { CatenvContext } from "@catladder/pipeline";
import { join } from "path";
import { getEnvironment } from "../../config/getProjectConfig";
import { getGitRoot } from "../../utils/projects";
import type { Choice } from "./types";
import {
  getComponentFullPath,
  getCurrentComponentAndEnvFromChoice,
} from "./utils";

export const writeDTsFiles = async (
  context: CatenvContext,
  choice?: Choice,
) => {
  const { env, currentComponent } = await getCurrentComponentAndEnvFromChoice(
    context.config,
    choice,
  );

  const componentsWithEnabledEnvDTsWrite = Object.entries(
    context.config.components,
  )
    .filter(([, component]) => component?.envDTs ?? true)
    .map(([componentName]) => componentName);

  const componentsToActuallyWriteEnvDts = currentComponent
    ? componentsWithEnabledEnvDTsWrite.includes(currentComponent)
      ? [currentComponent]
      : []
    : componentsWithEnabledEnvDTsWrite;
  const gitRoot = await getGitRoot();

  for (const componentName of componentsToActuallyWriteEnvDts) {
    const envNames = await getEnvsForDTs(env, componentName);
    const envDTsContent = createEnvDTsContent(envNames);

    const componentDir = getComponentFullPath(
      gitRoot,
      context.config,
      componentName,
    );
    const filePath = join(componentDir, "env.d.ts");
    await context.fileWriter.writeGeneratedFile(filePath, envDTsContent, {
      commentChar: "//",
    });
  }
};

async function getEnvsForDTs(
  env: string,
  componentName: string,
): Promise<string[]> {
  const environment = await getEnvironment(env, componentName);
  const allEnvKeys = Object.keys(environment.envVars);
  const hiddenEnvKeys = new Set(
    environment.secretEnvVarKeys
      .filter((s) => s.hidden)
      .map((s) => s.key)
      .concat(["_ALL_ENV_VAR_KEYS"]),
  );
  const dTsEnvKeys = allEnvKeys.filter((k) => !hiddenEnvKeys.has(k));

  return dTsEnvKeys;
}

function createEnvDTsContent(envNames: string[]) {
  return `/* tslint:disable prettier/prettier */
/* eslint-disable prettier/prettier */
/* prettier-ignore */

export {}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
${envNames.map((name) => `      ${name}: string`).join("\n")}
    }
  }
}
`;
}
