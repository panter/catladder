import type { CommitInfo } from "../../types";
import { getBuildId, getCurrentVersionString } from "./getBuildId";
export const getBaseCommitInfo = async (): Promise<
  Omit<CommitInfo, "trigger">
> => ({
  refName: process.env.CI_COMMIT_REF_NAME ?? "unknown",
  reviewSlug: process.env.CI_MERGE_REQUEST_IID
    ? `mr${process.env.CI_MERGE_REQUEST_IID}`
    : process.env.CI_COMMIT_REF_SLUG
    ? `hf${process.env.CI_COMMIT_REF_SLUG}`
    : "unknown",
  buildTime: new Date().toISOString(),
  buildId: await getBuildId(),
  currentVersion: await getCurrentVersionString(),
});
