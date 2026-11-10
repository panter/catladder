import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import type { GithubJob } from "../../types/github-types";
import { githubGlobalJobId } from "./createGithubJobs";
import { getGithubScriptFunctionDefinitions } from "./scriptFunctions";
import { notNil } from "../../utils";

/**
 * the image build jobs: always run (github has no server-side
 * changes-filter), the existence check makes unchanged runs fast.
 * Docker is native on github runners — no container, no dind.
 * `only` restricts to the named images (e.g. the create-release
 * workflow needs just the release image).
 */
export const makeEnsureImageGithubJobs = (
  images: JobImagesPlan,
  options: { only?: string[] } = {},
): Record<string, GithubJob> =>
  Object.fromEntries(
    images
      .getEnsureJobs()
      .filter((job) => !options.only || options.only.includes(job.name))
      .map((job) => [
        githubGlobalJobId(job.name),
        {
          name: job.name,
          "runs-on": "ubuntu-latest",
          steps: [
            { name: "Checkout", uses: "actions/checkout@v4" },
            {
              name: job.name,
              id: "main",
              run: [
                ...getGithubScriptFunctionDefinitions(),
                ...(job.script?.filter(notNil) ?? []),
              ].join("\n"),
              shell: "bash",
            },
          ],
        } satisfies GithubJob,
      ]),
  );

/**
 * id of the single job that makes sure all consumed custom job images
 * exist (instead of one job per image).
 */
export const ENSURE_IMAGES_JOB_ID = "catladder-images";

/**
 * Bundles the image build jobs into ONE job per workflow.
 *
 * Only images actually referenced in a `needs` of `jobs` (or listed in
 * `extraImages`, e.g. an image a later workflow relies on) are covered.
 * If there are none, `jobs` is returned unchanged and no job is added.
 * Otherwise all `needs` on a covered image job are rewritten to
 * `catladder-images` (deduplicated, order kept) and the combined job is
 * prepended.
 *
 * Every image gets its own step: an existing tag ends the image script
 * with `exit 0`, which must only end that step, not the other images'.
 * Each step is self-contained (function definitions, docker login).
 */
export const withEnsuredImages = (
  images: JobImagesPlan,
  jobs: Record<string, GithubJob>,
  options: { extraImages?: string[] } = {},
): Record<string, GithubJob> => {
  const imageJobs = new Map(
    images.getEnsureJobs().map((job) => [githubGlobalJobId(job.name), job]),
  );
  const extra = new Set(options.extraImages ?? []);

  const covered = new Set<string>();
  for (const [id, job] of imageJobs) {
    if (
      extra.has(job.name) ||
      extra.has(id) ||
      Object.values(jobs).some((j) => j.needs?.includes(id))
    ) {
      covered.add(id);
    }
  }
  if (covered.size === 0) {
    return jobs;
  }
  if (ENSURE_IMAGES_JOB_ID in jobs) {
    throw new Error(
      `job id "${ENSURE_IMAGES_JOB_ID}" is reserved for the combined image job`,
    );
  }

  const rewritten = Object.fromEntries(
    Object.entries(jobs).map(([id, job]) => [
      id,
      job.needs
        ? {
            ...job,
            needs: [
              ...new Set(
                job.needs.map((n) =>
                  covered.has(n) ? ENSURE_IMAGES_JOB_ID : n,
                ),
              ),
            ],
          }
        : job,
    ]),
  );

  const combined: GithubJob = {
    name: "catladder images",
    "runs-on": "ubuntu-latest",
    steps: [
      { name: "Checkout", uses: "actions/checkout@v4" },
      ...[...covered].map((id) => {
        const job = imageJobs.get(id)!;
        return {
          name: job.name,
          id: githubGlobalJobId(job.name),
          run: [
            ...getGithubScriptFunctionDefinitions(),
            ...(job.script?.filter(notNil) ?? []),
          ].join("\n"),
          shell: "bash",
        };
      }),
    ],
  };

  return { [ENSURE_IMAGES_JOB_ID]: combined, ...rewritten };
};
