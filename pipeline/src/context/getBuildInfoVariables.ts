import { BashExpression } from "../bash/BashExpression";
import type { BashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import { getBashExpressionPerPipelineType } from "../bash/bashExpressionPerPipelineType";
import type { EnvironmentContext } from "../types/environmentContext";

const BUILD_VARIABLES = {
  BUILD_INFO_BUILD_ID: {
    default: new BashExpression(
      `$(git describe --tags 2>/dev/null || git rev-parse HEAD)`,
    ),
  },
  BUILD_INFO_BUILD_TIME: {
    default: "unknown-build-time",
    gitlab: new BashExpression(`$CI_JOB_STARTED_AT`),
  },
  BUILD_INFO_CURRENT_VERSION: {
    default: new BashExpression(
      // because we do shallow fetch, we need to ask the origin
      `$(tag=$(git ls-remote origin "refs/tags/v*[0-9]" 2>/dev/null | cut -f 2- | sort -V | tail -1 | sed 's/refs\\/tags\\/v//'); [ -z "$tag" ] && echo "0.0.0" || echo "$tag")`,
    ),
  },
} satisfies {
  [key: string]: BashExpressionPerPipelineType;
};

export const getBuildInfoVariables = (ctx: EnvironmentContext) => {
  const { pipelineType } = ctx;

  return Object.fromEntries(
    Object.entries(BUILD_VARIABLES).map(([key, value]) => [
      key,
      getBashExpressionPerPipelineType(value, pipelineType),
    ]),
  );
};
