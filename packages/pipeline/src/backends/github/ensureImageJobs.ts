import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import type { GithubJob } from "../../types/github-types";
import { githubGlobalJobId } from "./createGithubJobs";
import { getGithubScriptFunctionDefinitions } from "./scriptFunctions";
import { notNil } from "../../utils";

/**
 * @deprecated one job per image — superseded by `makeEnsureImagesGithubJob`
 * / `withEnsureImages`; kept until the workflow builders are switched over.
 *
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
 * the single job per workflow that ensures all job images the workflow
 * needs (github bills every job rounded up to a full minute, so one job
 * per image is expensive for a check that nearly always just finds the
 * tag)
 */
export const ENSURE_IMAGES_JOB_ID = "catladder-images";
const ENSURE_IMAGES_JOB_NAME = "🐳 catladder images";

export const isEnsureImagesJobId = (id: string) => id === ENSURE_IMAGES_JOB_ID;

/**
 * one job ensuring every needed image: docker login once, then per image
 * the existence check (skips only that image) and, if the tag is missing,
 * build and push. Empty when no image is needed.
 */
export const makeEnsureImagesGithubJob = (
  images: JobImagesPlan,
  neededImageJobIds: Iterable<string>,
): Record<string, GithubJob> => {
  const needed = new Set(neededImageJobIds);
  const commands = images
    .getImageBuildCommands()
    .filter((image) => needed.has(githubGlobalJobId(image.jobName)));
  if (commands.length === 0) {
    return {};
  }
  const script = [
    ...getGithubScriptFunctionDefinitions(),
    "set -e",
    images.getDockerLoginCommand(),
    ...commands.flatMap(
      ({ jobName, exists, alreadyExistsMessage, build, push }) => [
        `echo "::group::${jobName}"`,
        `if ${exists}; then`,
        `  echo "${alreadyExistsMessage}"`,
        "else",
        `  ${build}`,
        `  ${push}`,
        "fi",
        `echo "::endgroup::"`,
      ],
    ),
  ].join("\n");

  return {
    [ENSURE_IMAGES_JOB_ID]: {
      name: ENSURE_IMAGES_JOB_NAME,
      "runs-on": "ubuntu-latest",
      steps: [
        { name: "Checkout", uses: "actions/checkout@v4" },
        {
          name: ENSURE_IMAGES_JOB_NAME,
          id: "main",
          run: script,
          shell: "bash",
        },
      ],
    },
  };
};

/**
 * adds the bundled image job to a workflow's jobs, if any is needed:
 * collects the image needs of all jobs (plus `extraImageJobNames`, for
 * images a later workflow relies on), rewrites them to the bundle id
 * (deduplicated, order-stable) and returns the jobs with the bundle first.
 */
export const withEnsureImages = (
  images: JobImagesPlan,
  jobs: Record<string, GithubJob>,
  extraImageJobNames: string[] = [],
): Record<string, GithubJob> => {
  const imageIds = new Set(
    images.getEnsureJobs().map((job) => githubGlobalJobId(job.name)),
  );
  const needed = new Set(extraImageJobNames.map(githubGlobalJobId));
  Object.values(jobs).forEach((job) =>
    job.needs?.filter((id) => imageIds.has(id)).forEach((id) => needed.add(id)),
  );
  const bundle = makeEnsureImagesGithubJob(images, needed);
  if (Object.keys(bundle).length === 0) {
    return jobs;
  }
  const rewritten = Object.fromEntries(
    Object.entries(jobs).map(([id, job]) => [
      id,
      job.needs?.some((need) => imageIds.has(need))
        ? {
            ...job,
            needs: [
              ...new Set(
                job.needs.map((need) =>
                  imageIds.has(need) ? ENSURE_IMAGES_JOB_ID : need,
                ),
              ),
            ],
          }
        : job,
    ]),
  );
  return { ...bundle, ...rewritten };
};
