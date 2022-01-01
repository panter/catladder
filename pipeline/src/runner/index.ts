import { PIPELINE_IMAGE_TAG, DOCKER_REGISTRY } from "../constants";

type RunnerImageName =
  | "jobs"
  | "kubernetes"
  | "base-pipeline"
  | "docker-build"
  | "semantic-release";
export const getRunnerImage = (imageName: RunnerImageName) =>
  DOCKER_REGISTRY + "/" + imageName + ":" + PIPELINE_IMAGE_TAG;
