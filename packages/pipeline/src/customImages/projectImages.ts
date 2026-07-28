import type { GitlabJobImage } from "../types/gitlab-types";

/**
 * a docker image declared by the project (`config.images`): built
 * automatically in the pipeline, content-hashed into the project's own
 * registry and rebuilt only when its inputs change.
 */
type ProjectImageCommon = {
  /**
   * the docker build context, relative to the repository root.
   *
   * Defaults to `dir` for a directory-based image, and to the
   * repository root (`.`) for an inline `dockerfile`.
   *
   * NOTE: the context itself is not hashed — only the Dockerfile (or
   * `dir`), `buildArgs` and `hashExtraPaths` are. List files that are
   * `COPY`ed from a wider context in `hashExtraPaths` if changing them
   * should rebuild the image.
   */
  context?: string;
  /**
   * extra files that influence the image content — they become part of
   * the content hash and the change detection
   */
  hashExtraPaths?: string[];
  /**
   * docker `--build-arg` values passed to the image build, part of the
   * content hash
   */
  buildArgs?: Record<string, string>;
};

/**
 * where the image definition comes from: a directory in the repository
 * containing a `Dockerfile`, or an inline Dockerfile written straight
 * into the config (materialized into the generated files)
 */
export type ProjectImageConfig = ProjectImageCommon &
  (
    | {
        /**
         * directory containing the `Dockerfile`, relative to the
         * repository root. Also the default build context.
         */
        dir: string;
        dockerfile?: never;
      }
    | {
        /**
         * the Dockerfile content, as one string or as lines. Written to
         * `.catladder-generated/images/project/<name>/Dockerfile`; the
         * build context defaults to the repository root.
         */
        dockerfile: string | string[];
        dir?: never;
      }
  );

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
