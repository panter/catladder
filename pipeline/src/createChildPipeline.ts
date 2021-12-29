import { createJobs } from "./createJos";
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

  const rules = [
    // same as rules "always", but with `changes` to only trigger changed branches
    { if: "$CI_COMMIT_TAG" },
    {
      if: "$CI_COMMIT_MESSAGE =~ /^chore(release).*/",
      when: "never",
    },
    { if: "$CI_COMMIT_BRANCH =~ /^[0-9]+.([0-9]+|x).x$/" },
    {
      if: "$CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH",
    },

    { if: "$CI_MERGE_REQUEST_ID" },
  ];

  const childPipeline = {
    image:
      "git.panter.ch:5001/catladder/gitlab-ci/pipeline:$PIPELINE_IMAGE_TAG",
    workflow: {
      rules,
    },
    stages: ["setup", "test", "build", "deploy", "verify", "actions"],
    ...jobs,
  };

  return childPipeline as typeof childPipeline & Record<string, GitlabJobDef>;
};
