import { getRunnerImage } from "../../runner";
import type { Pipeline } from "../../types";

type PickRequired<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;

export const createGitlabPipelineWithDefaults = ({
  image,
  variables,
  ...config
}: PickRequired<
  Partial<Pipeline<"gitlab">>,
  "stages" | "jobs"
>): Pipeline<"gitlab"> => {
  return {
    image: image ?? getRunnerImage("jobs-default"), // default image
    variables: {
      FF_USE_FASTZIP: "true", // enable fastzip - a faster zip implementation that also supports level configuration.
      ARTIFACT_COMPRESSION_LEVEL: "fast", // we value speed over compression
      CACHE_COMPRESSION_LEVEL: "fast", // same as above, but for caches
      TRANSFER_METER_FREQUENCY: "5s", // how often we should update the transfer meter for cache upload/download

      GIT_DEPTH: "1", // no need the full depth
      ...(variables ?? {}),
    },

    ...config,
  };
};
