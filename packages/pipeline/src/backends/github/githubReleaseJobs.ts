import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { githubGlobalJobId } from "./createGithubJobs";
import { getReleaseMethod } from "../../release";
import { GENERATED_CATCI_FOLDER } from "../../catci/shippedCatci";
import type { Config } from "../../types";
import type { GithubJob, GithubWorkflow } from "../../types/github-types";

const CATCI = `${GENERATED_CATCI_FOLDER}/index.js`;

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
 * the release jobs for the github backend (the counterpart of the
 * gitlab release jobs):
 * - releases.when === "auto": the release job runs in the main-branch
 *   workflow after all other jobs; a force variant goes to the manual
 *   tasks workflow
 * - otherwise (manual, the default): the release job goes to the
 *   manual tasks workflow. Its queue-check step releases right away on
 *   a green main run and otherwise queues the release for the
 *   release-on-green workflow (see getGithubReleaseOnGreenWorkflow) —
 *   the counterpart of gitlab's queue button + executor pair.
 */
export const getGithubReleaseJobs = (
  config: Config,
  mainWorkflowJobIds: string[],
  images: JobImagesPlan,
): {
  main: Record<string, GithubJob>;
  manual: Record<string, GithubJob>;
} => {
  const method = getReleaseMethod(config);
  if (config.releases?.when === "auto") {
    return {
      main: {
        "create-release": createReleaseJob(config, images, {
          needs: mainWorkflowJobIds,
        }),
      },
      manual: {
        "force-create-release": createReleaseJob(config, images, {
          extraEnv: method.forceReleaseVariables,
        }),
      },
    };
  }
  return {
    main: {},
    manual: {
      "create-release": createReleaseJob(config, images, { queueCheck: true }),
      // an explicit force option wherever the method distinguishes it
      // (e.g. changesets: release a patch bump without changesets)
      ...(method.forceReleaseVariables
        ? {
            "force-create-release": createReleaseJob(config, images, {
              extraEnv: method.forceReleaseVariables,
            }),
          }
        : {}),
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
    name: "catladder release on green",
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
