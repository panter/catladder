import { getProjectConfig } from "../../config/getProjectConfig";
import { printVariables } from "./printVariables";
import type { Choice } from "./types";
import { writeDotEnvFiles } from "./writeDotEnvFiles";
import { writeDTsFiles } from "./writeEnvDTs";
import {
  FileWriter,
  createCatenvContext,
  generatePipelineFiles,
} from "@catladder/pipeline";

export default async (choice?: Choice) => {
  const config = await getProjectConfig();
  if (!config) {
    return;
  }

  const context = createCatenvContext(config);

  await Promise.all([
    generatePipelineFiles(context, config.pipelineType ?? "gitlab"),
    writeDotEnvFiles(context, choice),

    writeDTsFiles(context, choice),

    printVariables(context, choice),
  ]);
};
