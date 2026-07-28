import type { GitlabJobImage } from "../types/gitlab-types";

/**
 * a docker image declared by the project (`config.images`): built
 * automatically in the pipeline, content-hashed into the project's own
 * registry and rebuilt only when its inputs change.
 */
export type ProjectImageConfig = {
  /**
   * the docker build context directory (must contain the `Dockerfile`),
   * relative to the repository root
   */
  dir: string;
  /**
   * extra files outside `dir` that influence the image content — they
   * become part of the content hash and the change detection
   */
  hashExtraPaths?: string[];
  /**
   * docker `--build-arg` values passed to the image build, part of the
   * content hash
   */
  buildArgs?: Record<string, string>;
};

/**
 * a reference to a project-declared job image (`config.images`), usable
 * in every `jobImage` field. The pipeline backends resolve it to the
 * concrete content-hashed image url in the project registry.
 */
export type ProjectImageRef = {
  /** the key of the image in `config.images` */
  image: string;
};

export const isProjectImageRef = (value: unknown): value is ProjectImageRef =>
  typeof value === "object" &&
  value !== null &&
  "image" in value &&
  typeof (value as ProjectImageRef).image === "string";

/**
 * everything a `jobImage` config field accepts: a concrete image (url
 * or gitlab image object) or a reference to a project-declared image
 */
export type JobImageConfig = GitlabJobImage | ProjectImageRef;
