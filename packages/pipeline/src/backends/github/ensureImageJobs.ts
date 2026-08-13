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
