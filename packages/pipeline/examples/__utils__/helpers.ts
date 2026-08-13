import { stringify } from "yaml";

import type { Config } from "../../src";
import {
  getGitlabCompletePipeline,
  GithubBackend,
  GithubScriptFiles,
  JobImagesPlan,
  PROJECT_IMAGES_FOLDER,
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
  const images = new JobImagesPlan("github", config.images);
  const workflows = await backend.createWorkflows(
    withFakeStore(config),
    images,
    scripts,
  );
  return [
    stringify(workflows, yamlStringifyOptions),
    // the materialized job scripts and inline Dockerfiles, so their
    // content stays snapshotted. The definitions catladder ships are
    // skipped — they are not part of what an example demonstrates
    ...[
      ...scripts.getGeneratedFiles(),
      ...images
        .getGeneratedFiles()
        .filter(({ path }) => path.startsWith(PROJECT_IMAGES_FOLDER)),
    ].map(({ path, content }) => `# ===== ${path} =====\n${content}`),
  ].join("\n");
};
