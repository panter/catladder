import { BASE_RETRY } from "../../defaults";
import type { GitlabJobDef } from "../../types";
import type { CatladderJob } from "../../types/jobs";

export const makeGitlabJob = ({
  envMode,
  needsStages,
  needsOtherComponent,
  name,
  ...rest
}: CatladderJob<string>): GitlabJobDef => {
  return {
    ...rest,
    retry: BASE_RETRY,
    interruptible: true,
  };
};
