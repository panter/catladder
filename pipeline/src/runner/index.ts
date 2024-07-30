import { PIPELINE_IMAGE_TAG, DOCKER_REGISTRY } from "../constants";

export type RunnerImageName =
  | "jobs-default"
  | "jobs-meteor"
  | "jobs-testing-chrome"
  | "kubernetes"
  | "docker-build"
  | "gcloud"
  | "semantic-release";
export const getRunnerImage = (imageName: RunnerImageName) =>
  DOCKER_REGISTRY + "/" + imageName + ":" + PIPELINE_IMAGE_TAG;
