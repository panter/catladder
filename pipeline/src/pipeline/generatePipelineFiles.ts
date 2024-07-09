import type { Config, PipelineMode, PipelineType } from "../types";
import { writeYamlfile } from "../utils/writeFiles";
import { createChildPipeline } from "./createChildPipeline";
import { createMainPipeline } from "./createMainPipeline";
import { getPipelineTriggerForGitlabChildPipeline } from "./gitlab/getPipelineTriggerForGitlabChildPipeline";
import { sortGitLabJobDefProps } from "./gitlab/sortGitLabJobDefProps";

export async function generateChildPipelineContent<T extends PipelineType>(
  config: Config,
  pipelineType: T,
) {
  const trigger = getPipelineTriggerForGitlabChildPipeline();
  const { jobs, image, stages, variables, workflow, ...pipelineRest } =
    await createChildPipeline(pipelineType, trigger, config);

  const jobsWithSortedProps = Object.fromEntries(
    Object.entries(jobs).map(([jobName, job]) => [
      jobName,
      sortGitLabJobDefProps(job),
    ]),
  );

  return {
    image,
    stages,
    variables,
    workflow,
    ...pipelineRest,
    // jobs need to be spread into main YAML, because GitLab pipeline YAML has no jobs key - jobs are top level with their key as their name
    ...jobsWithSortedProps,
  };
}

export async function generateLocalPipelineContent<T extends PipelineType>(
  config: Config,
  pipelineType: T,
) {
  const { jobs, image, stages, variables, workflow, ...pipelineRest } =
    await createMainPipeline(pipelineType, config);

  const jobsWithSortedProps = Object.fromEntries(
    Object.entries(jobs).map(([jobName, job]) => [
      jobName,
      sortGitLabJobDefProps(job),
    ]),
  );

  return {
    image,
    stages,
    variables,
    workflow,
    ...pipelineRest,
    // jobs need to be spread into main YAML, because GitLab pipeline YAML has no jobs key - jobs are top level with their key as their name
    ...jobsWithSortedProps,
  };
}

export async function generatePipelineFiles<T extends PipelineType>(
  config: Config,
  pipelineType: T,
  mode: PipelineMode<T>,
) {
  if (mode === "childpipeline") {
    const pipelineContent = await generateChildPipelineContent(
      config,
      pipelineType,
    );
    return writeYamlfile(`__pipeline.yml`, pipelineContent);
  }
  const pipelineContent = await generateLocalPipelineContent(
    config,
    pipelineType,
  );
  return writeYamlfile(`.gitlab-ci.yml`, pipelineContent);
}
