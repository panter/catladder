import {
  BashExpression,
  type StringOrBashExpression,
} from "../bash/BashExpression";
import type { BashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import { getBashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import type { PipelineType } from "../types";
import type { EnvConfigWithComponent } from "../types/config";
import { getEnvType } from "./getEnvType";
const REVIEW_SLUG: BashExpressionPerPipelineType = {
  default: "unknown-review-slug",
  gitlab: new BashExpression(
    `$([ -n "$CI_MERGE_REQUEST_IID" ] && echo "mr$CI_MERGE_REQUEST_IID" || { [ -n "$CI_COMMIT_REF_SLUG" ] && echo "$CI_COMMIT_REF_SLUG" || echo "unknown"; })`,
  ),
};

export const getReviewSlug = (
  envConfig: EnvConfigWithComponent,
  env: string,
  pipelineType?: PipelineType,
): StringOrBashExpression | null => {
  const envType = getEnvType(env, envConfig);
  if (envType === "review") {
    return getBashExpressionPerPipelineType(REVIEW_SLUG, pipelineType);
  }
  return null; // not a review app;
};
