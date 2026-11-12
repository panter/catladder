import { describe, expect, it } from "vitest";
import { JobImagesPlan } from "../../../customImages/jobImagesPlan";
import type { GithubJob } from "../../../types/github-types";
import {
  ENSURE_IMAGES_JOB_ID,
  isEnsureImagesJobId,
  makeEnsureImagesGithubJob,
  withEnsureImages,
} from "../ensureImageJobs";
import { githubGlobalJobId } from "../createGithubJobs";

const plan = () => {
  const images = new JobImagesPlan("github");
  images.resolveRef({ catladderImage: "jobs-default" } as any);
  images.resolveRef({ catladderImage: "docker-build" } as any);
  return images;
};

const idOf = (images: JobImagesPlan, i: number) =>
  githubGlobalJobId(images.getImageBuildCommands()[i].jobName);

const job = (needs?: string[]): GithubJob => ({
  "runs-on": "ubuntu-latest",
  steps: [],
  needs,
});

const script = (jobs: Record<string, GithubJob>) =>
  jobs[ENSURE_IMAGES_JOB_ID].steps[1].run as string;

describe("makeEnsureImagesGithubJob", () => {
  it("builds one job for all needed images with a single login", () => {
    const images = plan();
    const jobs = makeEnsureImagesGithubJob(images, [
      idOf(images, 0),
      idOf(images, 1),
    ]);
    expect(Object.keys(jobs)).toEqual([ENSURE_IMAGES_JOB_ID]);
    expect(jobs[ENSURE_IMAGES_JOB_ID].steps).toHaveLength(2);
    const run = script(jobs);
    expect(run.match(/docker login/g)).toHaveLength(1);
    expect(run.match(/docker push/g)).toHaveLength(2);
    expect(run).toContain("set -e");
    expect(run).not.toContain("exit 0");
  });

  it("excludes images that are not needed", () => {
    const images = plan();
    const jobs = makeEnsureImagesGithubJob(images, [idOf(images, 1)]);
    const [first, second] = images.getImageBuildCommands();
    expect(script(jobs)).not.toContain(first.imageRef);
    expect(script(jobs)).toContain(second.imageRef);
  });

  it("returns no job when no image is needed", () => {
    expect(makeEnsureImagesGithubJob(plan(), [])).toEqual({});
  });

  it("recognizes its id", () => {
    expect(isEnsureImagesJobId(ENSURE_IMAGES_JOB_ID)).toBe(true);
    expect(isEnsureImagesJobId("catladder-image-x")).toBe(false);
  });
});

describe("withEnsureImages", () => {
  it("rewrites image needs to the bundle, deduplicated and order-stable", () => {
    const images = plan();
    const [a, b] = [idOf(images, 0), idOf(images, 1)];
    const result = withEnsureImages(images, {
      build: job(["x", a, b]),
      test: job([b]),
      plain: job(),
    });
    expect(Object.keys(result)).toEqual([
      ENSURE_IMAGES_JOB_ID,
      "build",
      "test",
      "plain",
    ]);
    expect(result.build.needs).toEqual(["x", ENSURE_IMAGES_JOB_ID]);
    expect(result.test.needs).toEqual([ENSURE_IMAGES_JOB_ID]);
    expect(result.plain.needs).toBeUndefined();
  });

  it("adds no job when nothing consumes an image", () => {
    const jobs = { stop: job(["other"]) };
    expect(withEnsureImages(plan(), jobs)).toBe(jobs);
  });

  it("ensures extra images even without a consumer", () => {
    const images = plan();
    const [first] = images.getImageBuildCommands();
    const result = withEnsureImages(images, { stop: job() }, [first.jobName]);
    expect(script(result)).toContain(first.imageRef);
  });
});
