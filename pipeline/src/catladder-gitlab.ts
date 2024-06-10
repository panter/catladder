import { readConfigSync } from "./config";
import { generatePipelineFiles } from "./pipeline/generatePipelineFiles";
import type { PipelineMode } from "./types";

const mode = process.argv[2] || "local";

const config = readConfigSync()?.config;
if (!config) {
  throw new Error("no catladder config found");
}

generatePipelineFiles(config, "gitlab", mode as PipelineMode<"gitlab">);
