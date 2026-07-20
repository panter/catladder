import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { githubGlobalJobId } from "./createGithubJobs";
import { getReleaseMethod } from "../../release";
import type { Config } from "../../types";
import type { GithubJob } from "../../types/github-types";

const createReleaseJob = (
  config: Config,
  images: JobImagesPlan,
  needs?: string[],
): GithubJob => {
  const method = getReleaseMethod(config);
  const resolved = images.resolveRef({ catladderImage: method.image });
  const imageNeeds =
    resolved.need && typeof resolved.need === "object"
      ? [githubGlobalJobId(resolved.need.job)]
      : [];
  const allNeeds = [...imageNeeds, ...(needs ?? [])];
  return {
    name: "create release",
    "runs-on": "ubuntu-latest",
    container: {
      image: resolved.image,
      ...(resolved.fromRepoRegistry
        ? {
            credentials: {
              username: "${{ github.actor }}",
              password: "${{ github.token }}",
            },
          }
        : {}),
    },
    // the release method pushes the version tag and release commit,
    // and dispatches the taggedRelease workflow for the new tag (tags
    // pushed with the job token don't trigger `on: push: tags`).
    // Declaring permissions drops all default token grants, so the
    // packages read access (needed to pull the job image from the repo
    // registry) must be re-granted explicitly.
    permissions: {
      contents: "write",
      actions: "write",
      ...(resolved.fromRepoRegistry ? { packages: "read" } : {}),
    },
    ...(allNeeds.length > 0 ? { needs: allNeeds } : {}),
    env: {
      GITHUB_TOKEN: "${{ github.token }}",
    },
    steps: [
      {
        name: "Checkout",
        uses: "actions/checkout@v4",
        // the release method needs the full history (commits resp.
        // tags since the last release) to determine the version
        with: { "fetch-depth": 0 },
      },
      {
        name: "create release",
        run: method.script,
        shell: "bash",
      },
    ],
  };
};

/**
 * the release jobs for the github backend (the counterpart of the
 * gitlab release jobs):
 * - releases.when === "auto": the release job runs in the main-branch
 *   workflow after all other jobs; a force variant goes to the manual
 *   tasks workflow
 * - otherwise (manual, the default): the release job goes to the
 *   manual tasks workflow
 */
export const getGithubReleaseJobs = (
  config: Config,
  mainWorkflowJobIds: string[],
  images: JobImagesPlan,
): {
  main: Record<string, GithubJob>;
  manual: Record<string, GithubJob>;
} => {
  if (config.releases?.when === "auto") {
    return {
      main: {
        "create-release": createReleaseJob(config, images, mainWorkflowJobIds),
      },
      manual: { "force-create-release": createReleaseJob(config, images) },
    };
  }
  return {
    main: {},
    manual: { "create-release": createReleaseJob(config, images) },
  };
};
