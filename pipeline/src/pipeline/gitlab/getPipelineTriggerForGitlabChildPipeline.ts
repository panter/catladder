import type { PipelineTrigger } from "../..";
import { PIPELINE_IMAGE_TAG } from "../../constants";

export function getPipelineTriggerForGitlabChildPipeline() {
  const {
    CI_MERGE_REQUEST_ID,
    CI_COMMIT_TAG,
    CI_COMMIT_BRANCH,
    CI_DEFAULT_BRANCH,
  } = process.env;

  const isDefaultBranch =
    Boolean(CI_DEFAULT_BRANCH) && CI_COMMIT_BRANCH === CI_DEFAULT_BRANCH;
  const isHotfixBranch = CI_COMMIT_BRANCH
    ? /^[0-9]+\.([0-9]+|x)\.x$/.test(CI_COMMIT_BRANCH)
    : false;
  const isMergeRequest = Boolean(CI_MERGE_REQUEST_ID);
  const isTaggedRelease = Boolean(CI_COMMIT_TAG);

  console.info(`catladder version ${PIPELINE_IMAGE_TAG}`);

  const trigger: PipelineTrigger | null =
    isMergeRequest || isHotfixBranch
      ? "mr"
      : isDefaultBranch
        ? "mainBranch"
        : isTaggedRelease
          ? "taggedRelease"
          : null;

  if (!trigger) {
    throw new Error(
      "no matching trigger: " +
        JSON.stringify(
          {
            isMergeRequest,
            isDefaultBranch,
            isTaggedRelease,
          },
          null,
          2,
        ),
    );
  }
  return trigger;
}
