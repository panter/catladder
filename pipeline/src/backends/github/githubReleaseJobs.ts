import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { githubGlobalJobId } from "./createGithubJobs";
import type { Config } from "../../types";
import type { GithubJob } from "../../types/github-types";

const createReleaseJob = (
  images: JobImagesPlan,
  needs?: string[],
): GithubJob => {
  const resolved = images.resolveRef({ catladderImage: "semantic-release" });
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
    // semantic-release pushes the version tag and release commit
    permissions: { contents: "write" },
    ...(allNeeds.length > 0 ? { needs: allNeeds } : {}),
    env: {
      GITHUB_TOKEN: "${{ github.token }}",
    },
    steps: [
      {
        name: "Checkout",
        uses: "actions/checkout@v4",
        // semantic-release needs the full history to determine the version
        with: { "fetch-depth": 0 },
      },
      {
        name: "create release",
        run: "semanticRelease",
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
        "create-release": createReleaseJob(images, mainWorkflowJobIds),
      },
      manual: { "force-create-release": createReleaseJob(images) },
    };
  }
  return {
    main: {},
    manual: { "create-release": createReleaseJob(images) },
  };
};
