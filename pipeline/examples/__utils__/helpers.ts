import { stringify } from "yaml";

import type { Config } from "../../src";
import {
  getGitlabCompletePipeline,
  GithubBackend,
  GithubScriptFiles,
  yamlStringifyOptions,
} from "../../src";

const FAKE_PROJECT_NUMBER = "123456789012";

const collectGcloudProjectIds = (value: unknown): string[] => {
  if (!value || typeof value !== "object") {
    return [];
  }
  const obj = value as Record<string, unknown>;
  const own =
    obj.type === "google-cloudrun" && typeof obj.projectId === "string"
      ? [obj.projectId]
      : [];
  return [...own, ...Object.values(obj).flatMap(collectGcloudProjectIds)];
};

/**
 * examples don't ship a `.catladder-store` (normally written by
 * `catladder project setup`), so synthesize one: every gcloud project id
 * found in the config gets a fixed fake project number, keeping the
 * generated cloud run urls deterministic for snapshots.
 */
const withFakeStore = (config: Config): Config => ({
  ...config,
  store: {
    gcloudProjects: Object.fromEntries(
      [...new Set(collectGcloudProjectIds(config))].map((projectId) => [
        projectId,
        { projectNumber: FAKE_PROJECT_NUMBER },
      ]),
    ),
  },
});

export const createYamlLocalPipeline = async (
  config: Config,
): Promise<string> => {
  const pipelineContent = await getGitlabCompletePipeline(
    withFakeStore(config),
  );
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
  const backend = new GithubBackend();
  const scripts = new GithubScriptFiles();
  const workflows = await backend.createWorkflows(
    withFakeStore(config),
    undefined,
    scripts,
  );
  return [
    stringify(workflows, yamlStringifyOptions),
    // the materialized job scripts, so their content stays snapshotted
    ...scripts
      .getGeneratedFiles()
      .map(({ path, content }) => `# ===== ${path} =====\n${content}`),
  ].join("\n");
};
