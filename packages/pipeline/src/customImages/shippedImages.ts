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
};

/**
 * the docker build context of each image, mirroring the central image
 * builds: the jobs family builds from the images root (their
 * Dockerfiles INCLUDE sibling images), the others from their own dir
 * (their COPY paths are relative to it)
 */
export const RUNNER_IMAGE_BUILD_CONTEXT: Record<
  RunnerImageName,
  "root" | "self"
> = {
  "jobs-default": "root",
  "jobs-meteor": "root",
  kubernetes: "self",
  "docker-build": "self",
  "semantic-release": "self",
  changesets: "self",
  "npm-publish": "self",
  "agent-claude": "self",
};

/**
 * the directory containing the image definitions shipped with the
 * package (copied into dist at build time; the repository layout is
 * the fallback for development and tests)
 */
export const getShippedImagesDir = (): string => {
  const candidates = [
    // built pipeline package: dist/customImages -> dist/runner-images
    // bundled cli package (what consumers install): the ncc bundles live
    // in dist/bundles/<name>, so both resolve to dist/bundles/runner-images
    join(__dirname, "..", "runner-images"),
    // cli tsc dist (catenv-dev): dist/packages/pipeline/src/customImages -> dist/runner-images
    // repository: packages/pipeline/src/customImages -> <root>/runner-images
    join(__dirname, "..", "..", "..", "..", "runner-images"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("shipped job image definitions not found");
  }
  return found;
};

export const getShippedImageDir = (name: RunnerImageName): string =>
  join(getShippedImagesDir(), name);
