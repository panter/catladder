import { isObject } from "lodash";
import { BASE_RETRY } from "../../defaults";
import type { GitlabJobDef } from "../../types";
import type { CatladderJob, CatladderJobNeed } from "../../types/jobs";
const getJobName = (need: CatladderJobNeed) =>
  isObject(need) ? need.job : need;

export const makeGitlabJob = ({
  envMode,
  needsStages,
  needsOtherComponent,
  name,
  needs,
  ...rest
}: CatladderJob<string>): GitlabJobDef => {
  return {
    ...rest,
    // sort in a predictable manner for snapshot tests
    needs: needs?.sort((a, b) => getJobName(a).localeCompare(getJobName(b))),
    retry: BASE_RETRY,
    interruptible: true,
  };
};
