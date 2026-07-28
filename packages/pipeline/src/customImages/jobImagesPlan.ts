import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getCiVariable } from "../bash/ciVariables";
import { getDockerJobBaseProps } from "../build/docker";
import type { CatladderImageRef, RunnerImageName } from "../runner";
import { isCatladderImageRef } from "../runner";
import type { GitlabJobImage, PipelineType } from "../types";
import type { CatladderJob, CatladderJobNeed } from "../types/jobs";
import { collapseableSection } from "../utils/gitlab";
import { computeCustomImageHash } from "./hash";
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
 * plans the catladder job images of one backend run: resolves image
 * references, collects the image build jobs, and the image definitions
 * to materialize into the generated files. Each referenced catladder
 * image is built in the repository's own registry from the definition
 * shipped with catladder.
 *
 * Reference-driven: only images actually used by a job are built.
 */
export class JobImagesPlan {
  private used = new Map<RunnerImageName, { hash: string }>();
  private usedProject = new Map<
    string,
    { hash: string; watchedPaths: string[] }
  >();

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
    const name = ref.catladderImage;
    const { hash } = this.use(name);
    return {
      image: `${this.registryImageRef()}/catladder/${name}:${hash}`,
      fromRepoRegistry: true,
      need: {
        job: ensureJobName(name),
        artifacts: false,
        optional: true,
        global: true,
      },
    };
  }

  resolveProjectRef(ref: ProjectImageRef): ResolvedJobImage {
    const name = ref.image;
    const { hash } = this.useProject(name);
    return {
      // `job-images/` keeps the project's job images apart from its
      // deployable component images (registry root) and build caches
      image: `${this.registryImageRef()}/job-images/${name}:${hash}`,
      fromRepoRegistry: true,
      need: {
        job: projectEnsureJobName(name),
        artifacts: false,
        optional: true,
        global: true,
      },
    };
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

  private useProject(name: string): { hash: string; watchedPaths: string[] } {
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
    // fail at generation time with the offending image named: an
    // unreadable dir would otherwise surface as a bare fs ENOENT, and a
    // missing Dockerfile only as a docker build failure in CI
    if (!existsSync(imageConfig.dir)) {
      throw new Error(
        `job image "${name}": the directory "${imageConfig.dir}" does not exist (config.images.${name}.dir, relative to the repository root)`,
      );
    }
    if (!existsSync(join(imageConfig.dir, "Dockerfile"))) {
      throw new Error(
        `job image "${name}": no Dockerfile in "${imageConfig.dir}" (config.images.${name}.dir)`,
      );
    }
    const { hash, watchedPaths } = computeCustomImageHash({
      dir: imageConfig.dir,
      hashExtraPaths: imageConfig.hashExtraPaths,
      buildArgs: imageConfig.buildArgs,
    });
    const entry = { hash, watchedPaths };
    this.usedProject.set(name, entry);
    return entry;
  }

  private use(name: RunnerImageName): { hash: string } {
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
    const entry = { hash };
    this.used.set(name, entry);
    return entry;
  }

  /**
   * the image build jobs for all used images
   */
  getEnsureJobs(): CatladderJob[] {
    return [
      ...[...this.used.entries()].map(([name, { hash }]) =>
        this.createEnsureJob(name, hash),
      ),
      ...[...this.usedProject.entries()].map(([name, entry]) =>
        this.createProjectEnsureJob(name, entry),
      ),
    ];
  }

  private createEnsureJob(name: RunnerImageName, hash: string): CatladderJob {
    const imageRef = `${this.registryImageRef()}/catladder/${name}:${hash}`;

    const watchedDirs = [name, ...(RUNNER_IMAGE_DEPENDENCIES[name] ?? [])];

    return this.createImageBuildJob({
      jobName: ensureJobName(name),
      imageRef,
      watchedPaths: watchedDirs.map(
        (dir) => `${GENERATED_IMAGES_FOLDER}/${dir}/**/*`,
      ),
      buildCommand: `DOCKER_BUILDKIT=1 docker build -t ${imageRef} -f ${GENERATED_IMAGES_FOLDER}/${name}/Dockerfile ${
        RUNNER_IMAGE_BUILD_CONTEXT[name] === "root"
          ? GENERATED_IMAGES_FOLDER
          : `${GENERATED_IMAGES_FOLDER}/${name}`
      }`,
    });
  }

  private createProjectEnsureJob(
    name: string,
    { hash, watchedPaths }: { hash: string; watchedPaths: string[] },
  ): CatladderJob {
    const imageConfig = this.projectImages[name];
    const imageRef = `${this.registryImageRef()}/job-images/${name}:${hash}`;

    const buildArgFlags = Object.entries(imageConfig.buildArgs ?? {})
      .map(([key, value]) => ` --build-arg '${key}=${value}'`)
      .join("");

    return this.createImageBuildJob({
      jobName: projectEnsureJobName(name),
      imageRef,
      // the image dir is committed in the project repository — watched
      // in place, nothing is materialized. The config file is watched
      // too: buildArgs / hashExtraPaths changes alter the tag without
      // touching the dir
      watchedPaths: [...watchedPaths, CONFIG_FILE],
      buildCommand: `DOCKER_BUILDKIT=1 docker build -t ${imageRef}${buildArgFlags} -f ${imageConfig.dir}/Dockerfile ${imageConfig.dir}`,
    });
  }

  private createImageBuildJob({
    jobName,
    imageRef,
    watchedPaths,
    buildCommand,
  }: {
    jobName: string;
    imageRef: string;
    watchedPaths: string[];
    buildCommand: string;
  }): CatladderJob {
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
          changes: watchedPaths,
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
   * the image definitions of all used images, materialized into the
   * generated files (so pipelines build from committed, reviewable
   * files and gitlab's rules:changes can watch them)
   */
  getGeneratedFiles(): GeneratedImageFile[] {
    return [...this.used.keys()].flatMap((name) => {
      const dir = getShippedImageDir(name);
      return listFilesRecursive(dir).map((file) => ({
        path: join(GENERATED_IMAGES_FOLDER, name, file),
        content: readFileSync(join(dir, file), "utf-8"),
      }));
    });
  }
}

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
