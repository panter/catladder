import { existsSync } from "fs";
import { join } from "path";
import type { RunnerImageName } from "../runner";

/**
 * images whose Dockerfile INCLUDEs another image's Dockerfile
 * (dockerfile-x/dockerfile-plus, resolved against the images root as
 * build context)
 */
export const RUNNER_IMAGE_DEPENDENCIES: Partial<
  Record<RunnerImageName, RunnerImageName[]>
> = {
  "jobs-meteor": ["jobs-default"],
  "jobs-testing-chrome": ["jobs-default"],
};

/**
 * the docker build context of each image, mirroring the central image
 * builds: the jobs family builds from the images root (their
 * Dockerfiles INCLUDE sibling images), the others from their own dir
 * (their COPY paths are relative to it)
 */
/**
 * images that cannot be built from the shipped definitions and always
 * come from the central registry: semantic-release bakes catladder's
 * own cli sources into the image (repo-root build context).
 * TODO: make the semantic-release image self-contained.
 */
export const CENTRAL_ONLY_IMAGES: ReadonlySet<RunnerImageName> = new Set([
  "semantic-release",
]);

export const RUNNER_IMAGE_BUILD_CONTEXT: Record<
  RunnerImageName,
  "root" | "self"
> = {
  "jobs-default": "root",
  "jobs-meteor": "root",
  "jobs-testing-chrome": "root",
  kubernetes: "self",
  "docker-build": "self",
  gcloud: "self",
  "semantic-release": "self",
  "agent-claude": "self",
};

/**
 * the directory containing the image definitions shipped with the
 * package (copied into dist at build time; the repository layout is
 * the fallback for development and tests)
 */
export const getShippedImagesDir = (): string => {
  const candidates = [
    // built package: dist/customImages -> dist/runner-images
    join(__dirname, "..", "runner-images"),
    // repository: pipeline/src/customImages -> <root>/runner-images
    join(__dirname, "..", "..", "..", "runner-images"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("shipped job image definitions not found");
  }
  return found;
};

export const getShippedImageDir = (name: RunnerImageName): string =>
  join(getShippedImagesDir(), name);
