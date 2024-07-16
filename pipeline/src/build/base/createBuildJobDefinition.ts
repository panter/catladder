import type { BuildConfigStandalone, WorkspaceBuildConfig } from "..";
import { getRunnerImage } from "../../runner";
import type { Context } from "../../types";
import type { JobDefintion } from "../../types/jobDefinition";
import { ensureArray } from "../../utils";
import { getAllCacheConfigsFromConfig } from "../cache/getAllCacheConfigsFromConfig";
import { NODE_RUNNER_BUILD_VARIABLES } from "../node/constants";

export const createBuildJobDefinition = (
  context: Context,
  buildConfig: BuildConfigStandalone | WorkspaceBuildConfig,
  customize: Pick<JobDefintion, "cache"> & {
    prescript?: string[];
    postscript?: string[];
  } = {},
): JobDefintion | undefined => {
  if (buildConfig.buildCommand === null) return undefined;

  const defaultImage = getRunnerImage("jobs-default");

  return {
    image: buildConfig.jobImage ?? defaultImage,
    runnerVariables: NODE_RUNNER_BUILD_VARIABLES,
    cache: [
      ...(customize.cache ?? []),
      ...getAllCacheConfigsFromConfig(context, buildConfig),
    ],
    services:
      "jobServices" in buildConfig ? buildConfig.jobServices : undefined,
    script: [
      ...(customize.prescript ?? []),
      ...ensureArray(buildConfig.buildCommand),
      ...(customize.postscript ?? []),
    ],

    jobTags: buildConfig.jobTags,
  };
};
