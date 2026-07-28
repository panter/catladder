import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { githubGlobalJobId } from "./createGithubJobs";
import { makeEnsureImageGithubJobs } from "./ensureImageJobs";
import { getReleaseMethod } from "../../release";
import { GENERATED_CATCI_FOLDER } from "../../catci/shippedCatci";
import type { Config } from "../../types";
import type { GithubJob, GithubWorkflow } from "../../types/github-types";

const CATCI = `${GENERATED_CATCI_FOLDER}/index.js`;

/**
 * the build job of the release image only — the create-release
 * dispatch workflow needs no other image (empty for external images)
 */
const makeReleaseImageEnsureJobs = (
  config: Config,
  images: JobImagesPlan,
): Record<string, GithubJob> => {
  const resolved = images.resolveRef({
    catladderImage: getReleaseMethod(config).image,
  });
  if (!resolved.need || typeof resolved.need !== "object") {
    return {};
  }
  return makeEnsureImageGithubJobs(images, { only: [resolved.need.job] });
};

const createReleaseJob = (
  config: Config,
  images: JobImagesPlan,
  options: {
    needs?: string[];
    extraEnv?: Record<string, string>;
    /**
     * skip the `needs` on the image-build jobs — for jobs living in a
     * workflow that has none (the image is known to exist already)
     */
    skipImageNeeds?: boolean;
    /**
     * prepend the github-queue-check step: release right away when the
     * main workflow run for HEAD is green, queue the release (for the
     * release-on-green workflow) when it is still running, fail when it
     * concluded red
     */
    queueCheck?: boolean;
    /**
     * `if` expression on the queue-check step (e.g. skip it on a forced
     * release); a skipped check leaves `queued` empty, so the release
     * step still runs
     */
    queueCheckIf?: string;
  } = {},
): GithubJob => {
  const method = getReleaseMethod(config);
  const resolved = images.resolveRef({ catladderImage: method.image });
  const imageNeeds =
    !options.skipImageNeeds &&
    resolved.need &&
    typeof resolved.need === "object"
      ? [githubGlobalJobId(resolved.need.job)]
      : [];
  const allNeeds = [...imageNeeds, ...(options.needs ?? [])];
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
      ...options.extraEnv,
    },
    steps: [
      {
        name: "Checkout",
        uses: "actions/checkout@v4",
        // the release method needs the full history (commits resp.
        // tags since the last release) to determine the version
        with: { "fetch-depth": 0 },
      },
      ...(options.queueCheck
        ? [
            {
              name: "check main workflow",
              id: "queue",
              ...(options.queueCheckIf ? { if: options.queueCheckIf } : {}),
              run: `node ${CATCI} release github-queue-check`,
              shell: "bash",
            },
          ]
        : []),
      {
        name: "create release",
        ...(options.queueCheck
          ? { if: "steps.queue.outputs.queued != 'true'" }
          : {}),
        run: method.script,
        shell: "bash",
      },
    ],
  };
};

/**
 * the release jobs of the main-branch workflow: with releases.when ===
 * "auto" the release runs at the end of every main workflow run.
 * Manual releasing happens via the create-release dispatch workflow
 * (see getGithubCreateReleaseWorkflow) instead.
 */
export const getGithubReleaseJobs = (
  config: Config,
  mainWorkflowJobIds: string[],
  images: JobImagesPlan,
): Record<string, GithubJob> => {
  if (config.releases?.when !== "auto") {
    return {};
  }
  return {
    "create-release": createReleaseJob(config, images, {
      needs: mainWorkflowJobIds,
    }),
  };
};

/**
 * the dispatch workflow to trigger a release by hand — a first-class
 * entry in the Actions sidebar (the counterpart of gitlab's `create
 * release` button). Its queue-check step releases right away when the
 * main workflow run for HEAD is green and otherwise queues the release
 * for the release-on-green workflow. Where the release method
 * distinguishes a force mode (e.g. changesets: release a patch bump
 * without pending changesets), forcing is a checkbox input — a forced
 * release skips the queue-check and releases immediately, whatever the
 * pipeline state.
 */
export const getGithubCreateReleaseWorkflow = (
  config: Config,
  images: JobImagesPlan,
  workflowEnv: Record<string, string>,
): GithubWorkflow => {
  const method = getReleaseMethod(config);
  const forceVariables = method.forceReleaseVariables;
  const job = createReleaseJob(config, images, {
    queueCheck: true,
    ...(forceVariables
      ? {
          queueCheckIf: "${{ !inputs.force }}",
          // only effective when the force checkbox is ticked
          extraEnv: Object.fromEntries(
            Object.entries(forceVariables).map(([key, value]) => [
              key,
              `\${{ inputs.force && '${value}' || '' }}`,
            ]),
          ),
        }
      : {}),
  });
  return {
    name: "🚀 catladder create release",
    on: {
      workflow_dispatch: forceVariables
        ? {
            inputs: {
              force: {
                description:
                  "force: release even without pending changes (patch bump), ignoring the pipeline state",
                required: false,
                type: "boolean",
                default: false,
              },
            },
          }
        : {},
    },
    permissions: { contents: "read", packages: "write" },
    env: workflowEnv,
    jobs: {
      ...makeReleaseImageEnsureJobs(config, images),
      "create-release": job,
    },
  };
};

/**
 * the release-on-green workflow (manual release mode only): runs on
 * every completed main workflow run. A lightweight host job checks the
 * queue marker (written by the create-release task while the main
 * workflow was still running) — most runs have nothing queued and end
 * after that single quick job. When the marker matches the completed
 * run, the containerized release job creates the release.
 *
 * No image-build jobs here: the release image was ensured by the main
 * workflow run that just completed (same commit, same content-hashed
 * tag).
 */
export const getGithubReleaseOnGreenWorkflow = (
  config: Config,
  images: JobImagesPlan,
  mainWorkflowName: string,
  workflowEnv: Record<string, string>,
): GithubWorkflow | null => {
  if (config.releases?.when === "auto") {
    return null;
  }
  return {
    name: "🛠️ catladder release on green",
    on: {
      workflow_run: {
        workflows: [mainWorkflowName],
        types: ["completed"],
      },
    },
    env: workflowEnv,
    jobs: {
      guard: {
        name: "check queued release",
        "runs-on": "ubuntu-latest",
        // consuming the queue marker is a ref deletion
        permissions: { contents: "write" },
        env: { GITHUB_TOKEN: "${{ github.token }}" },
        outputs: { release: "${{ steps.guard.outputs.release }}" },
        steps: [
          { name: "Checkout", uses: "actions/checkout@v4" },
          {
            name: "check queued release",
            id: "guard",
            run: `node ${CATCI} release github-queued-guard "\${{ github.event.workflow_run.head_sha }}" "\${{ github.event.workflow_run.conclusion }}"`,
            shell: "bash",
          },
        ],
      },
      "create-release": {
        ...createReleaseJob(config, images, {
          needs: ["guard"],
          skipImageNeeds: true,
        }),
        if: "${{ needs.guard.outputs.release == 'true' }}",
      },
    },
  };
};

/**
 * the informational MR/PR check job of the release method (e.g. the
 * changeset check), added to the mr workflow. continue-on-error keeps
 * a missing changeset from blocking the PR — the sticky PR comment is
 * the visible surface on github.
 */
export const getGithubReleaseCheckJobs = (
  config: Config,
  images: JobImagesPlan,
): Record<string, GithubJob> => {
  const method = getReleaseMethod(config);
  if (!method.checkScript) {
    return {};
  }
  const resolved = images.resolveRef({ catladderImage: method.image });
  const imageNeeds =
    resolved.need && typeof resolved.need === "object"
      ? [githubGlobalJobId(resolved.need.job)]
      : [];
  return {
    "changeset-check": {
      name: "changeset check",
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
      permissions: {
        contents: "read",
        "pull-requests": "write",
        ...(resolved.fromRepoRegistry ? { packages: "read" } : {}),
      },
      ...(imageNeeds.length > 0 ? { needs: imageNeeds } : {}),
      "continue-on-error": true,
      env: {
        GITHUB_TOKEN: "${{ github.token }}",
      },
      steps: [
        {
          name: "Checkout",
          uses: "actions/checkout@v4",
          // full history: the check derives the next version from the
          // last v* tag
          with: { "fetch-depth": 0 },
        },
        {
          name: "changeset check",
          run: method.checkScript,
          shell: "bash",
        },
      ],
    },
  };
};
