import type { Pipeline, PipelineType } from "../types";
import type { Config, PipelineTrigger } from "../types/config";
import { createAllJobs } from "./createAllJobs";
import { getPipelineStages } from "./getPipelineStages";
import { createGitlabJobs } from "./gitlab/createGitlabJobs";
import { createGitlabPipelineFromStagesAndJobs } from "./gitlab/createGitlabPipeline";

export const createChildPipeline = async <T extends PipelineType>(
  type: T,
  trigger: PipelineTrigger,
  config: Config
): Promise<Pipeline<T>> => {
  const jobs = await createAllJobs(config, trigger);
  const stages = getPipelineStages(config);

  if (type === "gitlab") {
    const gitlabJobs = await createGitlabJobs(jobs);
    return createGitlabPipelineFromStagesAndJobs(
      stages,
      gitlabJobs
    ) as Pipeline<T>;
  }
  throw new Error(`${type} is not supported`);
};
