import type { Config } from "../types";
import { FileWriter } from "../utils/writeFiles";

export type CatenvContext = {
  config: Config;
  fileWriter: FileWriter;
};

export const createCatenvContext = (config: Config): CatenvContext => {
  return {
    config,
    fileWriter: FileWriter.create(config),
  };
};
