import { readConfig } from "./config";
import { generatePipelineFiles } from "./pipeline/generatePipelineFiles";

readConfig().then(async (result) => {
  if (!result?.config) {
    throw new Error("no catladder config found");
  }

  await generatePipelineFiles(result.config, "gitlab");
});
