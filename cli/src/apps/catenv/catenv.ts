import { getProjectConfig } from "../../config/getProjectConfig";
import { printVariables } from "./printVariables";
import type { Choice } from "./types";
import { writeDotEnvFiles } from "./writeDotEnvFiles";
import { writeDTsFiles } from "./writeEnvDTs";
import { generatePipelineFiles } from "@catladder/pipeline";

export default async (choice?: Choice) => {
  const config = await getProjectConfig();
  if (!config) {
    return;
  }

  await Promise.all([
    config.pipelineType
      ? generatePipelineFiles(config, config.pipelineType, "local")
      : undefined,
    writeDotEnvFiles(config, choice),

    writeDTsFiles(config, choice),

    printVariables(config, choice),
  ]);
};
