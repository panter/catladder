import { DOCKER_REGISTRY, PIPELINE_IMAGE_TAG } from "../constants";

export type RunnerImageName =
  | "jobs-default"
  | "jobs-meteor"
  | "jobs-testing-chrome"
  | "kubernetes"
  | "docker-build"
  | "semantic-release"
  | "changesets"
  | "agent-claude";

/**
 * a reference to a catladder-provided job image. It is resolved by the
 * pipeline backend according to the `jobImages` mode:
 * - central: the image from catladder's central registry
 * - repo: the image is built in the repository's own registry from the
 *   image definition shipped with catladder
 */
export type CatladderImageRef = {
  catladderImage: RunnerImageName;
};

export const isCatladderImageRef = (
  value: unknown,
): value is CatladderImageRef =>
  typeof value === "object" &&
  value !== null &&
  "catladderImage" in value &&
  typeof (value as CatladderImageRef).catladderImage === "string";

/**
 * job creators use this to reference a catladder-provided job image;
 * the backends resolve it to a concrete image url
 */
export const getRunnerImage = (
  imageName: RunnerImageName,
): CatladderImageRef => ({
  catladderImage: imageName,
});

/**
 * the image url in catladder's central registry (the classic behavior)
 */
export const getCentralRunnerImageUrl = (imageName: RunnerImageName): string =>
  DOCKER_REGISTRY + "/" + imageName + ":" + PIPELINE_IMAGE_TAG;
