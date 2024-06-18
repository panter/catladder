import { BashExpression } from "../bash/BashExpression";
import type { BashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import { getBashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import type { BuildConfig } from "../build";
import type { EnvironmentContext } from "../types/environmentContext";

const BUILD_TIME: BashExpressionPerPipelineType = {
  default: "unknown-build-time",
  gitlab: new BashExpression(`$CI_JOB_STARTED_AT`),
};

const BUILD_ID: BashExpressionPerPipelineType = {
  default: new BashExpression(
    `$(git describe --tags 2>/dev/null || git rev-parse HEAD)`,
  ),
};
const CURRENT_VERSION: BashExpressionPerPipelineType = {
  default: new BashExpression(
    // because we do shallow fetch, we need to ask the origin
    `$(tag=$(git ls-remote origin "refs/tags/v*[0-9]" 2>/dev/null | cut -f 2- | sort -V | tail -1 | sed 's/refs\\/tags\\/v//'); [ -z "$tag" ] && echo "0.0.0" || echo "$tag")`,
  ),
};

export const getBuildInfoVariables = (ctx: EnvironmentContext) => {
  const { pipelineType } = ctx;

  return {
    BUILD_INFO_BUILD_ID: getBashExpressionPerPipelineType(
      BUILD_ID,
      pipelineType,
    ),
    BUILD_INFO_BUILD_TIME: getBashExpressionPerPipelineType(
      BUILD_TIME,
      pipelineType,
    ),
    BUILD_INFO_CURRENT_VERSION: getBashExpressionPerPipelineType(
      CURRENT_VERSION,
      pipelineType,
    ),
  };
};
