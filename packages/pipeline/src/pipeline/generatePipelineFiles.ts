import { mkdir, rm } from "fs/promises";
import { dirname } from "path";
import type { Config, PipelineType } from "../types";

import type { PipelineBackend } from "../backends";
import { getEnabledPipelineTypes, getPipelineBackend } from "../backends";
import { GitlabBackend } from "../backends/gitlab";
import type { CatenvContext } from "../catenv";
import { GENERATED_IMAGES_FOLDER } from "../customImages/jobImagesPlan";
import { GENERATED_CATCI_FOLDER } from "../catci/shippedCatci";
import { generateAgentSkills } from "../agentSkills";

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

  if (!pipelineType) {
    // the materialized image definitions are a union across all enabled
    // backends and no single backend may wipe them — cleaned once per
    // full generation, so images that fell out of use don't linger (and
    // keep triggering gitlab's rules:changes)
    await rm(GENERATED_IMAGES_FOLDER, { recursive: true, force: true });
    // same for the materialized catci bundle (union across backends)
    await rm(GENERATED_CATCI_FOLDER, { recursive: true, force: true });
    // agent skills are backend-independent, materialized once per full
    // generation
    await generateAgentSkills(context);
  }

  for (const type of pipelineTypes) {
    await generatePipelineFilesForBackend(context, getPipelineBackend(type));
  }
}

async function generatePipelineFilesForBackend(
  context: CatenvContext,
  backend: PipelineBackend,
) {
  const files = await backend.createFiles(context.config);

  // first clean up previously generated files
  await backend.cleanup();
  // write files
  await Promise.all(
    files.map(async ({ path, content }) => {
      await mkdir(dirname(path), { recursive: true });
      if (typeof content === "string") {
        await context.fileWriter.writeGeneratedFileRaw(path, content);
      } else {
        await context.fileWriter.writeYamlfile(path, content);
      }
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
