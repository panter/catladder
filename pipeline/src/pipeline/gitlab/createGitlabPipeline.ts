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
      FF_USE_FASTZIP: "true",
      GIT_DEPTH: "1", // no need the full depth
      ...(variables ?? {}),
    },

    ...config,
  };
};
