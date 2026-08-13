import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getCiVariable } from "../bash/ciVariables";
import { getDockerJobBaseProps } from "../build/docker";
import type { CatladderImageRef, RunnerImageName } from "../runner";
import { isCatladderImageRef } from "../runner";
import type { GitlabJobImage, PipelineType } from "../types";
import type { CatladderJob, CatladderJobNeed } from "../types/jobs";
import { collapseableSection } from "../utils/gitlab";
import { computeCustomImageHash, computeInlineImageHash } from "./hash";
import type { ProjectImageConfig, ProjectImageRef } from "./projectImages";
import { isProjectImageRef } from "./projectImages";
import {
  getShippedImageDir,
  RUNNER_IMAGE_BUILD_CONTEXT,
  RUNNER_IMAGE_DEPENDENCIES,
} from "./shippedImages";

export const GENERATED_IMAGES_FOLDER = ".catladder-generated/images";

/**
 * the official docker cli image used to build the job images — NOT a
 * catladder image, so building images never depends on one (bootstrap)
 */
const BUILDER_IMAGE = "docker.io/docker:29.5.1";

export type ResolvedJobImage = {
  /** the concrete image url */
  image: string;
  /** the dependency on the image build job */
  need?: CatladderJobNeed;
  /** whether the image lives in the repository's own registry */
  fromRepoRegistry?: boolean;
};

export type GeneratedImageFile = { path: string; content: string };

/**
 * one planned image build, shared by catladder's own shipped images and
 * the project's declared ones: everything the build job and the
 * materialization need, independent of where the definition came from.
 */
type PlannedImage = {
  /** the content hash, i.e. the image tag */
  hash: string;
  /** the build job name */
  jobName: string;
  /** the full image url in the repository registry */
  imageRef: string;
  /** the `-f` argument of the docker build */
  dockerfilePath: string;
  /** the docker build context */
  contextDir: string;
  /** what gitlab's `rules:changes` watches */
  watchedPaths: string[];
  /** `--build-arg` values */
  buildArgs?: Record<string, string>;
  /**
   * definition files to write into the generated files — shipped image
   * dirs and inline Dockerfiles are materialized, a project image dir
   * is used in place and contributes nothing
   */
  files: GeneratedImageFile[];
};

/**
 * every planned image is consumed the same way: its url, plus an
 * optional dependency on its build job
 */
const toResolvedJobImage = ({
  imageRef,
  jobName,
}: PlannedImage): ResolvedJobImage => ({
  image: imageRef,
  fromRepoRegistry: true,
  need: {
    job: jobName,
    artifacts: false,
    optional: true,
    global: true,
  },
});

/**
 * materializes an image definition directory into the generated files
 * (used for the definitions catladder ships)
 */
const materializeDir = (
  sourceDir: string,
  targetDir: string,
): GeneratedImageFile[] =>
  listFilesRecursive(sourceDir).map((file) => ({
    path: join(targetDir, file),
    content: readFileSync(join(sourceDir, file), "utf-8"),
  }));

// built-in (catladder-shipped) images carry the catladder marker in
// their job name; project-declared images get the short plain name
const ensureJobName = (name: RunnerImageName) => `🐳 catladder image ${name}`;
const projectEnsureJobName = (name: string) => `🐳 image ${name}`;

/**
 * the config file whose content feeds the project image hashes
 * (`buildArgs`, `hashExtraPaths`): the gitlab change detection has to
 * watch it, because a config-only change alters the image tag without
 * touching the image dir
 */
const CONFIG_FILE = "catladder.ts";

/**
 * where inline project Dockerfiles are materialized — a subfolder, so a
 * project image can carry the same name as a shipped one
 */
export const PROJECT_IMAGES_FOLDER = `${GENERATED_IMAGES_FOLDER}/project`;

/**
 * plans the catladder job images of one backend run: resolves image
 * references, collects the image build jobs, and the image definitions
 * to materialize into the generated files. Each referenced catladder
 * image is built in the repository's own registry from the definition
 * shipped with catladder.
 *
 * Reference-driven: only images actually used by a job are built.
 */
export class JobImagesPlan {
  private used = new Map<RunnerImageName, PlannedImage>();
  private usedProject = new Map<string, PlannedImage>();

  constructor(
    private readonly pipelineType: PipelineType,
    private readonly projectImages: Record<string, ProjectImageConfig> = {},
  ) {}

  /**
   * resolves a job image (marker or concrete) to a concrete image url
   * plus the build job dependency
   */
  resolve(image: CatladderJob["image"]): {
    image: GitlabJobImage | undefined;
    need?: CatladderJobNeed;
    fromRepoRegistry?: boolean;
  } {
    if (isCatladderImageRef(image)) {
      return this.resolveRef(image);
    }
    if (isProjectImageRef(image)) {
      return this.resolveProjectRef(image);
    }
    return { image };
  }

  resolveRef(ref: CatladderImageRef): ResolvedJobImage {
    return toResolvedJobImage(this.use(ref.catladderImage));
  }

  resolveProjectRef(ref: ProjectImageRef): ResolvedJobImage {
    return toResolvedJobImage(this.useProject(ref.image));
  }

  /**
   * the registry image prefix. On github, container images can't use
   * runtime env vars — the expression form is required.
   */
  private registryImageRef(): string {
    return this.pipelineType === "github"
      ? "ghcr.io/${{ github.repository }}"
      : `${getCiVariable({ pipelineType: this.pipelineType }, "registryImage")}`;
  }

  private useProject(name: string): PlannedImage {
    const existing = this.usedProject.get(name);
    if (existing) {
      return existing;
    }
    const imageConfig = this.projectImages[name];
    if (!imageConfig) {
      const declared = Object.keys(this.projectImages);
      throw new Error(
        `unknown job image "${name}" — ${
          declared.length > 0
            ? `images declared in config.images: ${declared.join(", ")}`
            : "no images are declared in config.images"
        }`,
      );
    }

    const source = this.planProjectSource(name, imageConfig);
    const planned: PlannedImage = {
      ...source,
      jobName: projectEnsureJobName(name),
      buildArgs: imageConfig.buildArgs,
      // `job-images/` keeps the project's job images apart from its
      // deployable component images (registry root) and build caches
      imageRef: `${this.registryImageRef()}/job-images/${name}:${source.hash}`,
    };

    this.usedProject.set(name, planned);
    return planned;
  }

  /**
   * the source-dependent half of a project image: an inline Dockerfile
   * is materialized into the generated files and hashed by its content,
   * a directory is hashed and watched in place
   */
  private planProjectSource(
    name: string,
    imageConfig: ProjectImageConfig,
  ): Pick<
    PlannedImage,
    "hash" | "dockerfilePath" | "contextDir" | "watchedPaths" | "files"
  > {
    if (imageConfig.dockerfile !== undefined) {
      const content = toDockerfileContent(imageConfig.dockerfile);
      const dockerfilePath = `${PROJECT_IMAGES_FOLDER}/${name}/Dockerfile`;
      const { hash, watchedPaths } = computeInlineImageHash({
        dockerfileContent: content,
        hashExtraPaths: imageConfig.hashExtraPaths,
        buildArgs: imageConfig.buildArgs,
      });
      return {
        hash,
        dockerfilePath,
        // an inline definition carries no directory of its own — the
        // repository root is the sensible default context
        contextDir: imageConfig.context ?? ".",
        watchedPaths: [
          `${PROJECT_IMAGES_FOLDER}/${name}/**/*`,
          ...watchedPaths,
          CONFIG_FILE,
        ],
        files: [{ path: dockerfilePath, content }],
      };
    }

    const dir = imageConfig.dir;
    // fail at generation time with the offending image named: an
    // unreadable dir would otherwise surface as a bare fs ENOENT, and a
    // missing Dockerfile only as a docker build failure in CI
    if (!existsSync(dir)) {
      throw new Error(
        `job image "${name}": the directory "${dir}" does not exist (config.images.${name}.dir, relative to the repository root)`,
      );
    }
    if (!existsSync(join(dir, "Dockerfile"))) {
      throw new Error(
        `job image "${name}": no Dockerfile in "${dir}" (config.images.${name}.dir)`,
      );
    }
    const { hash, watchedPaths } = computeCustomImageHash({
      dir,
      hashExtraPaths: imageConfig.hashExtraPaths,
      buildArgs: imageConfig.buildArgs,
    });
    return {
      hash,
      dockerfilePath: `${dir}/Dockerfile`,
      contextDir: imageConfig.context ?? dir,
      // the dir is committed in the project — watched in place, nothing
      // is materialized. The config file is watched too: buildArgs /
      // hashExtraPaths changes alter the tag without touching the dir
      watchedPaths: [...watchedPaths, CONFIG_FILE],
      files: [],
    };
  }

  private use(name: RunnerImageName): PlannedImage {
    const existing = this.used.get(name);
    if (existing) {
      return existing;
    }
    const dependencies = RUNNER_IMAGE_DEPENDENCIES[name] ?? [];
    // dependencies are materialized (and hashed) as part of this image,
    // but also usable standalone
    dependencies.forEach((dependency) => this.use(dependency));
    const { hash } = computeCustomImageHash({
      dir: getShippedImageDir(name),
      extraDirs: dependencies.map((dependency) =>
        getShippedImageDir(dependency),
      ),
    });

    const targetDir = `${GENERATED_IMAGES_FOLDER}/${name}`;
    const planned: PlannedImage = {
      hash,
      jobName: ensureJobName(name),
      imageRef: `${this.registryImageRef()}/catladder/${name}:${hash}`,
      dockerfilePath: `${targetDir}/Dockerfile`,
      // the jobs family INCLUDEs sibling images, so it builds from the
      // images root; the others from their own dir
      contextDir:
        RUNNER_IMAGE_BUILD_CONTEXT[name] === "root"
          ? GENERATED_IMAGES_FOLDER
          : targetDir,
      watchedPaths: [name, ...dependencies].map(
        (dir) => `${GENERATED_IMAGES_FOLDER}/${dir}/**/*`,
      ),
      // pipelines build from committed, reviewable files (and gitlab's
      // rules:changes can watch them)
      files: materializeDir(getShippedImageDir(name), targetDir),
    };

    this.used.set(name, planned);
    return planned;
  }

  /**
   * the image build jobs for all used images
   */
  getEnsureJobs(): CatladderJob[] {
    return [...this.used.values(), ...this.usedProject.values()].map(
      (planned) => this.createImageBuildJob(planned),
    );
  }

  private createImageBuildJob({
    jobName,
    imageRef,
    watchedPaths,
    dockerfilePath,
    contextDir,
    buildArgs,
  }: PlannedImage): CatladderJob {
    const buildArgFlags = Object.entries(buildArgs ?? {})
      .map(([key, value]) => ` --build-arg '${key}=${value}'`)
      .join("");
    const buildCommand = `DOCKER_BUILDKIT=1 docker build -t ${imageRef}${buildArgFlags} -f ${dockerfilePath} ${contextDir}`;

    const ctx = { pipelineType: this.pipelineType };
    const registryUser = getCiVariable(ctx, "registryUser");
    const jobToken = getCiVariable(ctx, "jobToken");
    const registry = getCiVariable(ctx, "registry");

    const { services, runnerVariables } = getDockerJobBaseProps();

    return {
      name: jobName,
      stage: "setup",
      image: BUILDER_IMAGE,
      services,
      runnerVariables,
      needs: [],
      // gitlab: only run when the image definition changed; github has
      // no equivalent and always runs (the existence check is fast)
      rules: [
        {
          // a fresh array per job: the yaml serializer anchors repeated
          // objects, and a shared reference would reshuffle anchors
          changes: [...watchedPaths],
        },
      ],
      variables: {},
      script: [
        ...collapseableSection(
          "docker-login",
          "Docker Login",
        )([
          `docker login --username ${registryUser} --password ${jobToken} ${registry}`,
        ]),
        ...collapseableSection(
          "check-image",
          "Checking if image exists",
        )([
          `if docker manifest inspect ${imageRef} > /dev/null 2>&1; then`,
          `  echo "Image ${imageRef} already exists, skipping build"`,
          `  exit 0`,
          `fi`,
        ]),
        ...collapseableSection(
          "docker-build",
          "Building image",
        )([buildCommand]),
        ...collapseableSection(
          "docker-push",
          "Pushing image",
        )([`docker push ${imageRef}`]),
      ],
    };
  }

  /**
   * the image definitions to materialize into the generated files (so
   * pipelines build from committed, reviewable files and gitlab's
   * rules:changes can watch them): the definitions catladder ships and
   * the project's inline Dockerfiles. A project image directory is
   * already committed and contributes nothing.
   */
  getGeneratedFiles(): GeneratedImageFile[] {
    return [...this.used.values(), ...this.usedProject.values()].flatMap(
      ({ files }) => files,
    );
  }
}

/**
 * an inline Dockerfile is written as given — as one string, or as lines
 * joined with newlines (always newline-terminated)
 */
const toDockerfileContent = (dockerfile: string | string[]): string => {
  const content = Array.isArray(dockerfile)
    ? dockerfile.join("\n")
    : dockerfile;
  return content.endsWith("\n") ? content : `${content}\n`;
};

const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db"]);

const listFilesRecursive = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter(
      (entry) =>
        // OS junk files exist locally but not in CI checkouts
        !IGNORED_FILES.has(entry.split("/").pop() ?? "") &&
        statSync(join(dir, entry)).isFile(),
    )
    .sort();
