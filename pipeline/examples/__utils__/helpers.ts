import { stringify } from "yaml";

import type { Config } from "../../src";
import {
  getGitlabCompletePipeline,
  GithubBackend,
  yamlStringifyOptions,
} from "../../src";

export const createYamlLocalPipeline = async (
  config: Config,
): Promise<string> => {
  const pipelineContent = await getGitlabCompletePipeline(config);
  return stringify(pipelineContent, yamlStringifyOptions);
};

/**
 * all github workflows keyed by file name, as yaml.
 *
 * Every example is run through the github backend regardless of its
 * `pipelines` config (harness-driven coverage): each example must at
 * least lower to structurally valid workflows without throwing.
 */
export const createYamlGithubWorkflows = async (
  config: Config,
): Promise<string> => {
  const workflows = await new GithubBackend().createWorkflows(config);
  return stringify(workflows, yamlStringifyOptions);
};
