import { getProjectConfig } from "../../config/getProjectConfig";
import { printVariables } from "./printVariables";
import type { Choice } from "./types";
import { writeDotEnvFiles } from "./writeDotEnvFiles";
import { writeDTsFiles } from "./writeEnvDTs";

export default async (choice?: Choice) => {
  const config = await getProjectConfig();
  if (!config) {
    return;
  }

  await printVariables(config, choice);

  await writeDotEnvFiles(config, choice);

  await writeDTsFiles(config, choice);
};
