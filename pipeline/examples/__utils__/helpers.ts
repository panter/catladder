import { stringify } from "yaml";

import type { Config } from "../../src";
import { getGitlabCompletePipeline, yamlStringifyOptions } from "../../src";

export const createYamlLocalPipeline = async (
  config: Config,
): Promise<string> => {
  const pipelineContent = await getGitlabCompletePipeline(config);
  return stringify(pipelineContent, yamlStringifyOptions);
};
