import type { Config, PipelineType } from "../types";
import { writeYamlfile } from "../utils/writeFiles";
import { createMainPipeline } from "./createMainPipeline";
import { sortGitLabJobDefProps } from "./gitlab/sortGitLabJobDefProps";

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
) {
  const pipelineContent = await generateLocalPipelineContent(
    config,
    pipelineType,
  );
  return writeYamlfile(`.gitlab-ci.yml`, pipelineContent);
}
