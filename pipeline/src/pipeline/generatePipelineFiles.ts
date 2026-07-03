import { mkdir, rm } from "fs/promises";
import { dirname } from "path";
import type { Config, PipelineType } from "../types";

import type { PipelineBackend } from "../backends";
import { getEnabledPipelineTypes, getPipelineBackend } from "../backends";
import { GitlabBackend } from "../backends/gitlab";
import type { CatenvContext } from "../catenv";

/**
 * generates the pipeline files of all pipeline types enabled in the
 * config (see `pipelines`). Pass an explicit `pipelineType` to generate
 * only that one.
 */
export async function generatePipelineFiles(
  context: CatenvContext,
  pipelineType?: PipelineType,
) {
  const pipelineTypes = pipelineType
    ? [pipelineType]
    : getEnabledPipelineTypes(context.config);

  for (const type of pipelineTypes) {
    await generatePipelineFilesForBackend(context, getPipelineBackend(type));
  }
}

async function generatePipelineFilesForBackend(
  context: CatenvContext,
  backend: PipelineBackend,
) {
  const files = await backend.createFiles(context.config);

  // first clean up the folder
  await rm(backend.generatedFolder, { force: true, recursive: true });
  // write files
  await Promise.all(
    files.map(async ({ path, content }) => {
      await mkdir(dirname(path), { recursive: true });
      await context.fileWriter.writeYamlfile(path, content);
    }),
  );
}

/**
 *
 * for testing purposes
 */
export async function getGitlabCompletePipeline(config: Config) {
  return new GitlabBackend().createCompletePipeline(config);
}
