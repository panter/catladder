import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { getCiVariable } from "../bash/ciVariables";
import { getDockerJobBaseProps } from "../build/docker";
import type { CatladderImageRef, RunnerImageName } from "../runner";
import { getCentralRunnerImageUrl, isCatladderImageRef } from "../runner";
import type { Config, GitlabJobImage, PipelineType } from "../types";
import type { CatladderJob, CatladderJobNeed } from "../types/jobs";
import { collapseableSection } from "../utils/gitlab";
import { computeCustomImageHash } from "./hash";
import {
  CENTRAL_ONLY_IMAGES,
  getShippedImageDir,
  RUNNER_IMAGE_BUILD_CONTEXT,
  RUNNER_IMAGE_DEPENDENCIES,
} from "./shippedImages";

const GENERATED_IMAGES_FOLDER = ".catladder-generated/images";

/**
 * the official docker cli image used to build the job images — NOT a
 * catladder image, so building images never depends on one (bootstrap)
 */
const BUILDER_IMAGE = "docker.io/docker:29.5.1";

export type JobImagesMode = "central" | "repo";

export const getJobImagesMode = (
  config: Config,
  pipelineType: PipelineType,
): JobImagesMode =>
  // the central registry is not reachable from github runners
  config.jobImages ?? (pipelineType === "github" ? "repo" : "central");

export type ResolvedJobImage = {
  /** the concrete image url */
  image: string;
  /** the dependency on the image build job (repo mode only) */
  need?: CatladderJobNeed;
  /** whether the image lives in the repository's own registry */
  fromRepoRegistry?: boolean;
};

export type GeneratedImageFile = { path: string; content: string };

const ensureJobName = (name: RunnerImageName) => `🐳 job image ${name}`;

/**
 * plans the catladder job images of one backend run: resolves image
 * references, and (in repo mode) collects the image build jobs and the
 * image definitions to materialize into the generated files.
 *
 * Reference-driven: only images actually used by a job are built.
 */
export class JobImagesPlan {
  private used = new Map<RunnerImageName, { hash: string }>();

  constructor(
    readonly mode: JobImagesMode,
    private readonly pipelineType: PipelineType,
  ) {}

  /**
   * resolves a job image (marker or concrete) to a concrete image url
   * plus the build job dependency in repo mode
   */
  resolve(image: CatladderJob["image"]): {
    image: GitlabJobImage | undefined;
    need?: CatladderJobNeed;
    fromRepoRegistry?: boolean;
  } {
    if (!isCatladderImageRef(image)) {
      return { image };
    }
    return this.resolveRef(image);
  }

  resolveRef(ref: CatladderImageRef): ResolvedJobImage {
    const name = ref.catladderImage;
    if (this.mode === "central" || CENTRAL_ONLY_IMAGES.has(name)) {
      return { image: getCentralRunnerImageUrl(name) };
    }
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

  /**
   * the registry image prefix. On github, container images can't use
   * runtime env vars — the expression form is required.
   */
  private registryImageRef(): string {
    return this.pipelineType === "github"
      ? "ghcr.io/${{ github.repository }}"
      : `${getCiVariable({ pipelineType: this.pipelineType }, "registryImage")}`;
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
   * the image build jobs for all used images (repo mode; empty in
   * central mode)
   */
  getEnsureJobs(): CatladderJob[] {
    return [...this.used.entries()].map(([name, { hash }]) =>
      this.createEnsureJob(name, hash),
    );
  }

  private createEnsureJob(name: RunnerImageName, hash: string): CatladderJob {
    const ctx = { pipelineType: this.pipelineType };
    const registryUser = getCiVariable(ctx, "registryUser");
    const jobToken = getCiVariable(ctx, "jobToken");
    const registry = getCiVariable(ctx, "registry");
    const imageRef = `${this.registryImageRef()}/catladder/${name}:${hash}`;

    const watchedDirs = [name, ...(RUNNER_IMAGE_DEPENDENCIES[name] ?? [])];

    const { services, runnerVariables } = getDockerJobBaseProps();

    return {
      name: ensureJobName(name),
      stage: "setup",
      image: BUILDER_IMAGE,
      services,
      runnerVariables,
      needs: [],
      // gitlab: only run when the image definition changed; github has
      // no equivalent and always runs (the existence check is fast)
      rules: [
        {
          changes: watchedDirs.map(
            (dir) => `${GENERATED_IMAGES_FOLDER}/${dir}/**/*`,
          ),
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
        )([
          `DOCKER_BUILDKIT=1 docker build -t ${imageRef} -f ${GENERATED_IMAGES_FOLDER}/${name}/Dockerfile ${
            RUNNER_IMAGE_BUILD_CONTEXT[name] === "root"
              ? GENERATED_IMAGES_FOLDER
              : `${GENERATED_IMAGES_FOLDER}/${name}`
          }`,
        ]),
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
