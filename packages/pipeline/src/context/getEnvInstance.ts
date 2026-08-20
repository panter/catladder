import { BashExpression } from "@catladder/bash";
import type { BashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import { getBashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import type { PipelineType } from "../types";
import type {
  EnvConfigWithComponent,
  EnvironmentConfig,
} from "../types/config";
import type { EnvironmentInstance } from "../types/environmentContext";
import { getEnvOn } from "./getEnvOn";
const REVIEW_SLUG: BashExpressionPerPipelineType = {
  default: "unknown-review-slug",
  gitlab: new BashExpression(
    `$([ -n "$CI_MERGE_REQUEST_IID" ] && echo "mr$CI_MERGE_REQUEST_IID" || { [ -n "$CI_COMMIT_REF_SLUG" ] && echo "$CI_COMMIT_REF_SLUG" || echo "unknown"; })`,
  ),
  // CL_PR_NUMBER is injected by the github backend at the workflow level
  github: new BashExpression(
    `$([ -n "$CL_PR_NUMBER" ] && echo "pr$CL_PR_NUMBER" || echo "unknown")`,
  ),
};

export const getEnvInstance = (
  envConfig: EnvConfigWithComponent,
  env: string,
  pipelineType?: PipelineType,
  environments?: Record<string, EnvironmentConfig>,
): EnvironmentInstance => {
  // an env deploying per merge request is a review app — one dynamic
  // instance per MR, identified by the review slug
  if (getEnvOn(env, envConfig, environments) === "mr") {
    return {
      type: "review",
      reviewSlug: getBashExpressionPerPipelineType(REVIEW_SLUG, pipelineType),
    };
  }
  return { type: "stable" };
};
