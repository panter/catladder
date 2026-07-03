import { GITLAB_CI_VARIABLES } from "../backends/gitlab/ciVariables";
import type { PipelineType } from "../types/pipeline";
import { BashExpression } from "./BashExpression";

/**
 * platform-neutral names for variables that the CI system provides at
 * runtime. Job creators must use these (via {@link getCiVariable}) instead
 * of hardcoding e.g. gitlab's `$CI_*` variables, so that other pipeline
 * types can map them to their own predefined variables.
 */
export type CiVariableName =
  | "commitSha"
  | "jobToken"
  | "jobImage"
  | "registry"
  | "registryImage";

const CI_VARIABLES_PER_PIPELINE_TYPE: {
  [T in PipelineType]: Record<CiVariableName, string>;
} = {
  gitlab: GITLAB_CI_VARIABLES,
};

/**
 * resolves a platform-neutral CI variable to a bash expression for the
 * pipeline type of the given context.
 */
export const getCiVariable = (
  context: { pipelineType?: PipelineType },
  name: CiVariableName,
): BashExpression => {
  // contexts without an explicit pipeline type (e.g. local/catenv) keep
  // resolving to gitlab, which matches the previously hardcoded values
  const pipelineType = context.pipelineType ?? "gitlab";
  return new BashExpression(
    `$${CI_VARIABLES_PER_PIPELINE_TYPE[pipelineType][name]}`,
  );
};
