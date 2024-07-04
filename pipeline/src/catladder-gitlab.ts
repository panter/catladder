import { readConfig } from "./config";
import { generatePipelineFiles } from "./pipeline/generatePipelineFiles";
import type { PipelineMode } from "./types";

const mode = process.argv[2] || "local";

const config = readConfig().then(async (result) => {
  if (!result?.config) {
    throw new Error("no catladder config found");
  }

  await generatePipelineFiles(
    result.config,
    "gitlab",
    mode as PipelineMode<"gitlab">,
  );
});
