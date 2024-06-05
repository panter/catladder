import type { Pipeline, PipelineType } from "../types";
import type { Config, PipelineTrigger } from "../types/config";
import { createAllJobs } from "./createAllJobs";
import { getPipelineStages } from "./getPipelineStages";
import { createGitlabJobs } from "./gitlab/createGitlabJobs";
import { createGitlabPipelineFromStagesAndJobs } from "./gitlab/createGitlabPipeline";

export const createChildPipeline = async <T extends PipelineType>(
  pipelineType: T,
  trigger: PipelineTrigger,
  config: Config
): Promise<Pipeline<T>> => {
  const jobs = await createAllJobs({
    config,
    trigger,
    pipelineType,
  });
  const stages = getPipelineStages(config);

  if (pipelineType === "gitlab") {
    const gitlabJobs = await createGitlabJobs(jobs);
    return createGitlabPipelineFromStagesAndJobs(
      stages,
      gitlabJobs
    ) as Pipeline<T>;
  }
  throw new Error(`${pipelineType} is not supported`);
};
