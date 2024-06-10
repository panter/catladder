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

  if (config.pipelineType) {
    await generatePipelineFiles(config, config.pipelineType, "local");
  }

  await writeDotEnvFiles(config, choice);

  await writeDTsFiles(config, choice);

  await printVariables(config, choice);
};
