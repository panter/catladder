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

type Options = {
  verbose?: boolean;
  printVariables?: boolean;
};
export default async (choice?: Choice, options?: Options) => {
  const config = await getProjectConfig();
  if (!config) {
    return;
  }

  const context = createCatenvContext(config);
  if (options?.verbose) {
    printVerboseBanner();
  }

  await Promise.all([
    generatePipelineFiles(context, config.pipelineType ?? "gitlab"),
    writeDotEnvFiles(context, choice),

    writeDTsFiles(context, choice),
    options?.printVariables
      ? printVariables(context, choice)
      : Promise.resolve(),
  ]);
};
