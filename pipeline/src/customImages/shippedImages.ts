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
