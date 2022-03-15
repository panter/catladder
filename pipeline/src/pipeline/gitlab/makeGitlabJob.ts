import { BASE_RETRY } from "../../defaults";
import { GitlabJobDef } from "../../types";
import { CatladderJob } from "../../types/jobs";

export const makeGitlabJob = ({
  envMode,
  needsStages,
  name,
  ...rest
}: CatladderJob<string>): GitlabJobDef => {
  return {
    ...rest,
    retry: BASE_RETRY,
    interruptible: true,
  };
};
