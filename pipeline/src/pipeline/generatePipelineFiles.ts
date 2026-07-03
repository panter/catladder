import { mkdir, rm } from "fs/promises";
import { dirname } from "path";
import type { Config, PipelineType } from "../types";

import { getPipelineBackend } from "../backends";
import { GitlabBackend } from "../backends/gitlab";
import type { CatenvContext } from "../catenv";

export async function generatePipelineFiles<T extends PipelineType>(
  context: CatenvContext,
  pipelineType: T,
) {
  const backend = getPipelineBackend(pipelineType);

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
