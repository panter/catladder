import { getAllEnvsInAllComponents } from "../config";
import { RULES_ALWAYS } from "../rules";
import { getRunnerImage } from "../runner";
import type { GitlabPipeline, Pipeline, PipelineType } from "../types";
import type { Config, PipelineTrigger } from "../types/config";
import { BASE_STAGES } from "../types/jobs";
import { createAllJobs } from "./createAllJobs";
import { createGitlabJobs } from "./gitlab/createGitlabJobs";

export const createChildPipeline = async <T extends PipelineType>(
  type: T,
  trigger: PipelineTrigger,
  config: Config
): Promise<Pipeline<T>> => {
  const jobs = await createAllJobs(config, trigger);

  // while technically not required, we group different envs in its own stage
  // each job from `createJobs` that is defined as `envMode: "stagePerEnv"` will have `deploy dev`, etc. instead of just `deploy`
  // this is just so that it looks nicer in gitlab and makes running mutliple manual tasks more easy to use

  const allEnvs = getAllEnvsInAllComponents(config);
  const stages = BASE_STAGES.reduce<string[]>(
    (acc, baseStage) => [
      ...acc,
      baseStage,
      ...allEnvs.map((e) => `${baseStage} ${e}`),
    ],
    []
  );
  if (type === "gitlab") {
    const pipeline: GitlabPipeline = {
      image: getRunnerImage("jobs-default"), // default image
      variables: {
        FF_USE_FASTZIP: "true",
        GIT_DEPTH: 1, // no need the full depth
      },
      workflow: {
        rules: RULES_ALWAYS,
      },
      stages,
      jobs: await createGitlabJobs(jobs),
    };
    return pipeline as Pipeline<T>;
  }
  throw new Error(`${type} is not supported`);
};
