import { getProjectConfig } from "../../config/getProjectConfig";
import { printVariables } from "./printVariables";
import type { Choice } from "./types";
import { printVerboseBanner } from "./verboseBanner";
import { writeDotEnvFiles } from "./writeDotEnvFiles";
import { writeDTsFiles } from "./writeEnvDTs";
import {
  createCatenvContext,
  generatePipelineFiles,
} from "@catladder/pipeline";
import type { SecretsMode } from "../../vault";
import { createNonInteractiveIO } from "../../adapters/nonInteractive";

type Options = {
  verbose?: boolean;
  printVariables?: boolean;
  vaultMode?: SecretsMode;
};
export default async (choice?: Choice, options?: Options) => {
  const config = await getProjectConfig();
  if (!config) {
    return;
  }

  const io = createNonInteractiveIO({ vaultMode: options?.vaultMode });
  const context = { ...createCatenvContext(config), io };
  if (options?.verbose) {
    printVerboseBanner();
  }

  await Promise.all([
    generatePipelineFiles(context),
    writeDotEnvFiles(context, choice),

    writeDTsFiles(context, choice),
    options?.printVariables
      ? printVariables(context, choice)
      : Promise.resolve(),
  ]);
};
