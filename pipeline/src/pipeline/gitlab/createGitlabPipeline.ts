import { RULES_ALWAYS } from "../../rules";
import { getRunnerImage } from "../../runner";
import type { Pipeline } from "../../types";
import type { AllGitlabJobs } from "./createGitlabJobs";

export function createGitlabPipelineFromStagesAndJobs(
  stages: string[],
  gitlabJobs: AllGitlabJobs
): Pipeline<"gitlab"> {
  return {
    image: getRunnerImage("jobs-default"), // default image
    variables: {
      FF_USE_FASTZIP: "true",
      GIT_DEPTH: 1, // no need the full depth
    },
    workflow: {
      rules: RULES_ALWAYS,
    },
    stages,
    jobs: gitlabJobs,
  };
}
