import type { PipelineType } from "../types/pipeline";
import type { BashExpression } from "./BashExpression";

export type BashExpressionPerPipelineType = {
  [type in PipelineType]?: BashExpression | string;
} & {
  default: BashExpression | string;
};

export const getBashExpressionPerPipelineType = (
  definition: BashExpressionPerPipelineType,
  pipelineType?: PipelineType
) => {
  if (!pipelineType) return definition.default;
  return definition[pipelineType] || definition.default;
};
