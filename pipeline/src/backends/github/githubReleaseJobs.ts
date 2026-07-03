import { getRunnerImage } from "../../runner";
import type { Config } from "../../types";
import type { GithubJob } from "../../types/github-types";

const createReleaseJob = (needs?: string[]): GithubJob => ({
  name: "create release",
  "runs-on": "ubuntu-latest",
  container: { image: getRunnerImage("semantic-release") },
  // semantic-release pushes the version tag and release commit
  permissions: { contents: "write" },
  ...(needs && needs.length > 0 ? { needs } : {}),
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
});

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
): {
  main: Record<string, GithubJob>;
  manual: Record<string, GithubJob>;
} => {
  if (config.releases?.when === "auto") {
    return {
      main: { "create-release": createReleaseJob(mainWorkflowJobIds) },
      manual: { "force-create-release": createReleaseJob() },
    };
  }
  return {
    main: {},
    manual: { "create-release": createReleaseJob() },
  };
};
