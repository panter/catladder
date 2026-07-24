import type { Pipeline } from "../../types";
import { globalScriptFunctions } from "@catladder/bash";
import {
  RULE_IS_MAIN_BRANCH_AND_NOT_RELEASE_COMMIT,
  RULE_IS_MERGE_REQUEST,
  RULE_IS_TAGGED_RELEASE,
} from "../../rules";
type PickRequired<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

/**
 * gitlab requires a top-level default image for jobs that don't set their
 * own. Every catladder-generated job sets an explicit image, so this
 * fallback is never actually pulled — it just needs to be a valid,
 * build-free image (a catladder job image would drag in a build job).
 */
const DEFAULT_PIPELINE_IMAGE = "node:22";

export const createGitlabPipelineWithDefaults = ({
  image,
  variables,
  before_script,
  ...config
}: PickRequired<
  Partial<Pipeline<"gitlab">>,
  "stages" | "jobs"
>): Pipeline<"gitlab"> => {
  return {
    image: image ?? DEFAULT_PIPELINE_IMAGE,
    variables: {
      FF_USE_FASTZIP: "true", // enable fastzip - a faster zip implementation that also supports level configuration.
      ARTIFACT_COMPRESSION_LEVEL: "fast", // we value speed over compression
      CACHE_COMPRESSION_LEVEL: "fast", // same as above, but for caches
      TRANSFER_METER_FREQUENCY: "5s", // how often we should update the transfer meter for cache upload/download

      GIT_DEPTH: "1", // no need the full depth
      ...(variables ?? {}),
    },
    before_script: [
      ...[...globalScriptFunctions.values()].map((script) =>
        script.toBashFunction(),
      ),
      ...(before_script ?? []),
    ],
    workflow: {
      name: "$PIPELINE_ICON $PIPELINE_NAME",
      rules: [
        {
          if: '$CI_PIPELINE_SOURCE  == "trigger"',
          variables: {
            PIPELINE_ICON: "🤖",
            PIPELINE_NAME: "Thinking...",
          },
        },
        {
          if: RULE_IS_MERGE_REQUEST.if,
          variables: {
            PIPELINE_ICON: "🐱🔨",
            PIPELINE_NAME: "mr$CI_MERGE_REQUEST_IID - $CI_MERGE_REQUEST_TITLE",
          },
        },
        {
          if: RULE_IS_TAGGED_RELEASE.if,
          variables: {
            PIPELINE_ICON: "🐱📦",
            PIPELINE_NAME: "Release $CI_COMMIT_TAG",
          },
        },
        {
          if: RULE_IS_MAIN_BRANCH_AND_NOT_RELEASE_COMMIT.if,
          variables: {
            PIPELINE_ICON: "🐱🔨",
            PIPELINE_NAME: "Main - $CI_COMMIT_TITLE",
          },
        },

        {
          when: "always", // fallback
          variables: {
            PIPELINE_ICON: "🐱❓",
            PIPELINE_NAME: "Default",
          },
        },
      ],
    },

    ...config,
  };
};
