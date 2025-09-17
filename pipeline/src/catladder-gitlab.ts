import { readConfig } from "./config";
import { generatePipelineFiles } from "./pipeline/generatePipelineFiles";
import { createCatenvContext } from "./catenv";

readConfig().then(async (result) => {
  if (!result?.config) {
    throw new Error("no catladder config found");
  }

  const context = createCatenvContext(result.config);

  await generatePipelineFiles(context, "gitlab");
});
