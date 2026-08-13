export type RunnerImageName =
  | "jobs-default"
  | "jobs-meteor"
  | "kubernetes"
  | "docker-build"
  | "semantic-release"
  | "changesets"
  | "npm-publish"
  | "agent-claude";

/**
 * a reference to a catladder-provided job image. The pipeline backend
 * resolves it to a concrete image url: the image is built in the
 * repository's own registry from the image definition shipped with
 * catladder.
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
