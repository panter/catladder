import { describe, expect, it } from "vitest";
import { JobImagesPlan } from "../../../customImages/jobImagesPlan";
import type { GithubJob } from "../../../types/github-types";
import { githubGlobalJobId } from "../createGithubJobs";
import { ENSURE_IMAGES_JOB_ID, withEnsuredImages } from "../ensureImageJobs";

const planWith = (...names: ("kubernetes" | "semantic-release")[]) => {
  const plan = new JobImagesPlan("github");
  const ids = names.map((name) => {
    plan.resolveRef({ catladderImage: name });
    return name;
  });
  const jobIds = plan.getEnsureJobs().map((j) => githubGlobalJobId(j.name));
  return { plan, ids, jobIds };
};

const consumer = (needs?: string[]): GithubJob => ({
  "runs-on": "ubuntu-latest",
  needs,
  steps: [{ run: "echo hi" }],
});

describe("withEnsuredImages", () => {
  it("adds no job when nothing consumes an image", () => {
    const { plan } = planWith("kubernetes");
    const jobs = { build: consumer(), test: consumer(["build"]) };

    expect(withEnsuredImages(plan, jobs)).toBe(jobs);
  });

  it("bundles two consumed images into one job with one step per image", () => {
    const { plan, jobIds } = planWith("kubernetes", "semantic-release");
    const result = withEnsuredImages(plan, {
      a: consumer([jobIds[0]]),
      b: consumer([jobIds[1]]),
    });

    expect(Object.keys(result)).toEqual([ENSURE_IMAGES_JOB_ID, "a", "b"]);
    const steps = result[ENSURE_IMAGES_JOB_ID].steps;
    expect(steps).toHaveLength(3); // checkout + 2 images
    expect(steps[0].uses).toBe("actions/checkout@v4");
    expect(steps[1].run).not.toBe(steps[2].run);
  });

  it("rewrites needs to the combined job, deduplicated, order kept", () => {
    const { plan, jobIds } = planWith("kubernetes", "semantic-release");
    const result = withEnsuredImages(plan, {
      a: consumer(["x", jobIds[0], jobIds[1], "y"]),
    });

    expect(result.a.needs).toEqual(["x", ENSURE_IMAGES_JOB_ID, "y"]);
  });

  it("covers extraImages even without a consumer, but only those", () => {
    const { plan, jobIds } = planWith("kubernetes", "semantic-release");
    const result = withEnsuredImages(
      plan,
      { a: consumer() },
      { extraImages: [jobIds[1]] },
    );

    expect(result[ENSURE_IMAGES_JOB_ID].steps).toHaveLength(2);
    expect(result[ENSURE_IMAGES_JOB_ID].steps[1].run).toContain(
      "semantic-release",
    );
  });

  it("keeps the combined job in needs so an aggregate gate can depend on it", () => {
    const { plan, jobIds } = planWith("kubernetes");
    const result = withEnsuredImages(plan, { a: consumer([jobIds[0]]) });
    const gateNeeds = Object.values(result).flatMap((j) => j.needs ?? []);

    expect(gateNeeds).toContain(ENSURE_IMAGES_JOB_ID);
    expect(Object.keys(result)).toContain(ENSURE_IMAGES_JOB_ID);
  });

  it("throws when the id collides with a component job", () => {
    const { plan, jobIds } = planWith("kubernetes");

    expect(() =>
      withEnsuredImages(plan, {
        [ENSURE_IMAGES_JOB_ID]: consumer([jobIds[0]]),
      }),
    ).toThrowError(/reserved/);
  });
});
