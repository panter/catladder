import { stringify } from "yaml";

import type { Config } from "../../src";
import {
  createChildPipeline,
  generateLocalPipelineContent,
  yamlStringifyOptions,
} from "../../src";

const ALL_TRIGGERS = ["mainBranch", "taggedRelease", "mr"] as const;

export const createAllPipelines = async (config: Config) =>
  Object.fromEntries(
    await Promise.all(
      ALL_TRIGGERS.map(async (trigger) => [
        trigger,
        await createChildPipeline("gitlab", trigger, config),
      ]),
    ),
  );

export const createYamlLocalPipeline = async (
  config: Config,
): Promise<string> => {
  const pipelineContent = await generateLocalPipelineContent(config, "gitlab");
  return stringify(pipelineContent, yamlStringifyOptions);
};
