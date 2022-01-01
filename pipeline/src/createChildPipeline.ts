import { createJobs } from "./createJos";
import { RULES_ALWAYS } from "./rules";
import { getRunnerImage } from "./runner";
import { Config, ENV_TYPES, PipelineTrigger } from "./types/config";
import { GitlabJobDef } from "./types/gitlab-types";

export const createChildPipeline = async (
  trigger: PipelineTrigger,
  config: Config
) => {
  const envs = Object.keys(ENV_TYPES).filter(
    (e) => ENV_TYPES[e as keyof typeof ENV_TYPES].trigger === trigger
  );
  const components = Object.keys(config.components);

  // 2. write the triggering pipeline

  const jobs = components.reduce<Record<string, GitlabJobDef>>(
    (acc, componentName) => {
      return {
        ...acc,
        ...createJobs(envs, config, componentName),
      };
    },
    {}
  );

  const childPipeline = {
    image: getRunnerImage("jobs"), // default image
    workflow: {
      rules: RULES_ALWAYS,
    },
    stages: ["setup", "test", "build", "deploy", "verify", "actions"],
    ...jobs,
  };

  return childPipeline as typeof childPipeline & Record<string, GitlabJobDef>;
};
