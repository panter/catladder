import { stringify } from "yaml";

import type { Config } from "../../src";
import { generateLocalPipelineContent, yamlStringifyOptions } from "../../src";

export const createYamlLocalPipeline = async (
  config: Config,
): Promise<string> => {
  const pipelineContent = await generateLocalPipelineContent(config, "gitlab");
  return stringify(pipelineContent, yamlStringifyOptions);
};
