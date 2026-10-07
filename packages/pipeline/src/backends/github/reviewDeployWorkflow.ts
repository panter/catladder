import { GENERATED_CATCI_FOLDER } from "../../catci/shippedCatci";
import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { providesCapability } from "../../pipeline/resolveRequirements";
import {
  getReviewAppsSwitchLabel,
  isReviewDeliveryJob,
  isReviewDeployGated,
  type ResolvedReviewAppsConfig,
} from "../../reviewApps";
import type { Context } from "../../types";
import type {
  GithubJob,
  GithubStep,
  GithubWorkflow,
} from "../../types/github-types";
import type { CatladderJob } from "../../types/jobs";
import { AGGREGATE_CHECK_JOB_ID } from "./aggregateCheckJob";
import { makeEnsureImageGithubJobs } from "./ensureImageJobs";

const CATCI = `${GENERATED_CATCI_FOLDER}/index.js`;

/**
 * the generated review deploy workflow. Keep in sync with
 * GITHUB_REVIEW_DEPLOY_WORKFLOW in apps/cli/src/reviewApps/github.ts.
 */
export const REVIEW_DEPLOY_WORKFLOW_FILE = "catladder-deploy-review.yml";

const GUARD_JOB_ID = "catladder-review-deploy-guard";
const TRIGGER_JOB_ID = "catladder-review-deploy-trigger";

/** the PR of the run — from the event, or the dispatch input */
const PR_NUMBER_EXPRESSION = "github.event.number || inputs.pr";

type TriggerJobs = Map<
  string,
  { githubJob: GithubJob; job: CatladderJob; context: Context }
>;

/** quote a value for a github expression string literal */
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** combine a job's existing `if` with another condition */
const andIf = (existing: string | undefined, condition: string) => {
  if (!existing) {
    return `\${{ ${condition} }}`;
  }
  const unwrapped = existing.replace(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/, "$1");
  return `\${{ (${unwrapped}) && (${condition}) }}`;
};

/**
 * the condition under which the review workflow deploys the review apps
 * ITSELF, decided from the pull request event at the start of the run
 * (labels, draft) — the common case then needs one run and one app
 * build, like gitlab's switch job. Whatever changes later (a label set
 * during or after the run, a draft marked ready, an explicit request) is
 * handled by the review deploy workflow. `deploy: "manual"` never
 * deploys on its own: undefined.
 */
export const getInRunDeployCondition = (
  reviewApps: ResolvedReviewAppsConfig,
): string | undefined => {
  const labels = "github.event.pull_request.labels.*.name";
  const policy =
    reviewApps.deploy === "optIn"
      ? `contains(${labels}, ${literal(reviewApps.label)})`
      : reviewApps.deploy === "optOut"
        ? `!contains(${labels}, ${literal(reviewApps.skipLabel)})`
        : reviewApps.deploy === "auto"
          ? undefined
          : null;
  if (policy === null) {
    return undefined;
  }
  const notDraft =
    reviewApps.drafts !== "likeReady"
      ? "!github.event.pull_request.draft"
      : undefined;
  return [policy, notDraft].filter(Boolean).join(" && ") || "true";
};

/** combine a job's `if` with the in-run deploy condition */
export const withInRunCondition = (job: GithubJob, condition: string) => ({
  ...job,
  if: andIf(job.if, condition),
});

/**
 * the review delivery jobs (docker → deploy → verify) that move out of
 * the review workflow into the review deploy workflow:
 * - all of them when the reviewApps config gates review deploys
 * - otherwise those of components whose review deploy is manual
 *   (`deploy.when: "manual"`) — github has no manual jobs inside a run,
 *   and the generic manual-task dispatch can't carry the pull request
 */
export const getGatedReviewDeliveryJobIds = (
  triggerJobs: TriggerJobs,
  reviewApps: ResolvedReviewAppsConfig,
): string[] => {
  const gatedByConfig = isReviewDeployGated(reviewApps);
  const manualComponents = new Set(
    [...triggerJobs.values()]
      .filter(
        ({ job, context }) =>
          isReviewDeliveryJob(context, job) &&
          job.stage === "deploy" &&
          job.gate === "manual",
      )
      .map(({ context }) => context.name),
  );
  const ids = new Set(
    [...triggerJobs]
      .filter(
        ([, { job, context }]) =>
          isReviewDeliveryJob(context, job) &&
          (gatedByConfig || manualComponents.has(context.name)),
      )
      .map(([id]) => id),
  );
  // jobs depending on a moved job (e.g. a custom e2e job waiting for a
  // review deploy) can't stay behind: they move along
  let grown = ids.size > 0;
  while (grown) {
    grown = false;
    for (const [id, { githubJob }] of triggerJobs) {
      if (!ids.has(id) && githubJob.needs?.some((need) => ids.has(need))) {
        ids.add(id);
        grown = true;
      }
    }
  }
  return [...ids];
};

/**
 * the review deploy workflow (`▶️ catladder deploy review`): the review
 * delivery chains of a pull request, behind a guard that decides
 * whether this run deploys (see `catci review-app github-guard`).
 *
 * Started by
 * - the review workflow, once it is green and the label/draft policy
 *   says the PR deploys (`source: ci`)
 * - switching the label on (opt-in: adding it, opt-out: removing the
 *   skip label) or marking a draft ready (`drafts: "checksOnly"`)
 * - a human or agent dispatching it with the PR number — explicit
 *   requests always deploy, provided the PR's CI is green
 *
 * Artifacts are scoped to a single run, so the run rebuilds what the
 * chains need (the app build); tests are not rerun — the guard checks
 * the PR's `catladder ✅` instead.
 */
export const makeReviewDeployWorkflow = ({
  deliveryIds,
  triggerJobs,
  reviewApps,
  images,
  workflowEnv,
  permissions,
}: {
  deliveryIds: string[];
  triggerJobs: TriggerJobs;
  reviewApps: ResolvedReviewAppsConfig;
  images: JobImagesPlan;
  workflowEnv: Record<string, string>;
  permissions: GithubWorkflow["permissions"];
}): GithubWorkflow => {
  const delivery = new Set(deliveryIds);
  const isQualityJob = (id: string) => {
    const entry = triggerJobs.get(id);
    return !!entry && providesCapability(entry.job, "qualityGate");
  };

  // the delivery jobs plus everything upstream they need from the
  // trigger (rebuilt in this run), except the quality jobs
  const included = new Set<string>();
  const stack = [...deliveryIds];
  let current: string | undefined;
  while ((current = stack.pop()) !== undefined) {
    if (included.has(current)) continue;
    included.add(current);
    for (const need of triggerJobs.get(current)?.githubJob.needs ?? []) {
      if (triggerJobs.has(need) && !isQualityJob(need)) stack.push(need);
    }
  }

  // the guard runs first, every other job only when it says deploy
  const gatedJob = (job: GithubJob): GithubJob => ({
    ...job,
    needs: [GUARD_JOB_ID, ...(job.needs ?? [])],
    if: andIf(job.if, `needs.${GUARD_JOB_ID}.outputs.deploy == 'true'`),
  });

  const checkoutPrHead = (step: GithubStep): GithubStep =>
    step.uses?.startsWith("actions/checkout@")
      ? {
          ...step,
          // the PR head — a label event's default is the merge ref
          with: {
            ...step.with,
            ref: "${{ github.event.pull_request.head.sha || github.sha }}",
          },
        }
      : step;

  const chainJobs = Object.fromEntries(
    [...included].sort().map((id) => {
      const { githubJob } = triggerJobs.get(id)!;
      return [
        id,
        gatedJob({
          ...githubJob,
          // the quality jobs stay in the review workflow — the guard
          // checks their aggregate instead
          ...(githubJob.needs
            ? {
                needs: githubJob.needs.filter(
                  (need) => !isQualityJob(need) || delivery.has(need),
                ),
              }
            : {}),
          steps: githubJob.steps.map(checkoutPrHead),
        }),
      ];
    }),
  );

  // only the images the chains run in (not e.g. the release image)
  const neededIds = new Set(
    Object.values(chainJobs).flatMap((job) => job.needs ?? []),
  );
  const imageJobs = Object.fromEntries(
    Object.entries(makeEnsureImageGithubJobs(images))
      .filter(([id]) => neededIds.has(id))
      .map(([id, job]) => [id, gatedJob(job)]),
  );

  const switchLabel = getReviewAppsSwitchLabel(reviewApps);
  const pullRequestTypes = [
    ...(switchLabel ? [switchLabel.deployOn] : []),
    ...(reviewApps.drafts === "checksOnly" ? ["ready_for_review"] : []),
  ];
  // pull request events that concern the review apps — other label
  // changes must neither run the guard nor cancel a running deploy
  const relevantEvent = [
    "github.event_name == 'workflow_dispatch'",
    ...(switchLabel
      ? [
          `(github.event.action == ${literal(switchLabel.deployOn)} && github.event.label.name == ${literal(switchLabel.label)})`,
        ]
      : []),
    ...(reviewApps.drafts === "checksOnly"
      ? ["github.event.action == 'ready_for_review'"]
      : []),
  ].join(" || ");

  return {
    name: "▶️ catladder deploy review",
    on: {
      workflow_dispatch: {
        inputs: {
          pr: {
            description:
              "number of the pull request whose review apps to deploy",
            required: true,
            type: "string",
          },
          source: {
            description:
              "who requests the deploy: manual (always deploys) or ci (applies the label/draft policy)",
            required: false,
            type: "choice",
            options: ["manual", "ci"],
            default: "manual",
          },
        },
      },
      ...(pullRequestTypes.length > 0
        ? { pull_request: { types: pullRequestTypes } }
        : {}),
    },
    concurrency: reviewDeployConcurrency(relevantEvent),
    permissions,
    env: { ...workflowEnv, CL_PR_NUMBER: `\${{ ${PR_NUMBER_EXPRESSION} }}` },
    jobs: {
      [GUARD_JOB_ID]: {
        name: "🚦 review deploy guard",
        "runs-on": "ubuntu-latest",
        ...(pullRequestTypes.length > 0
          ? { if: `\${{ ${relevantEvent} }}` }
          : {}),
        permissions: {
          contents: "read",
          "pull-requests": "read",
          checks: "read",
          statuses: "write",
        },
        env: {
          GITHUB_TOKEN: "${{ github.token }}",
          CL_REVIEW_APPS: JSON.stringify(reviewApps),
          CL_DEPLOY_SOURCE:
            "${{ github.event_name == 'workflow_dispatch' && (inputs.source || 'manual') || 'label' }}",
          CL_HEAD_SHA:
            "${{ github.event.pull_request.head.sha || github.sha }}",
        },
        outputs: { deploy: "${{ steps.main.outputs.deploy }}" },
        steps: [
          catciCheckout(),
          {
            name: "🚦 review deploy guard",
            id: "main",
            run: `node ${CATCI} review-app github-guard`,
            shell: "bash",
          },
          {
            // the pull request shows the deploy in flight
            name: "report pending review app",
            if: "${{ steps.main.outputs.deploy == 'true' }}",
            env: { GH_TOKEN: "${{ github.token }}" },
            run: `gh api "repos/$GITHUB_REPOSITORY/statuses/$CL_HEAD_SHA" -f state=pending -f context="${REVIEW_APP_STATUS_CONTEXT}" -f description="deploying the review apps" -f target_url="$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID" > /dev/null`,
            shell: "bash",
          },
        ],
      },
      ...imageJobs,
      ...chainJobs,
      ...makeReviewAppAggregateJob(
        [GUARD_JOB_ID, ...Object.keys(imageJobs), ...Object.keys(chainJobs)],
        `needs.${GUARD_JOB_ID}.outputs.deploy == 'true'`,
      ),
    },
  };
};

export const REVIEW_APP_AGGREGATE_JOB_ID = "catladder-review-app-ok";
export const REVIEW_APP_AGGREGATE_JOB_NAME = "catladder review app ✅";
/** the commit status context the aggregate job reports */
export const REVIEW_APP_STATUS_CONTEXT = "catladder review app";

/**
 * one job with a STABLE name that succeeds exactly when the review apps
 * of this run deployed and verified — the result a merge gate (a bot,
 * or a branch rule for projects that deploy every PR) waits for,
 * regardless of the project's components.
 *
 * It also reports a commit status on the PR head: runs started by a
 * dispatch (the trigger job, or by hand) are attached to the commit but
 * not shown on the pull request, a commit status always is.
 *
 * Runs only when the run deploys (the guard decided so, or the review
 * workflow's start condition held) — a run that doesn't deploy says
 * nothing about the review app (its check is skipped, the commit status
 * untouched).
 */
export const makeReviewAppAggregateJob = (
  needs: string[],
  /** when the run deploys the review apps (a github expression) */
  deploysWhen: string,
): Record<string, GithubJob> => ({
  [REVIEW_APP_AGGREGATE_JOB_ID]: {
    name: REVIEW_APP_AGGREGATE_JOB_NAME,
    "runs-on": "ubuntu-latest",
    needs: [...needs].sort(),
    if: `\${{ always() && (${deploysWhen}) }}`,
    permissions: { statuses: "write" },
    env: {
      GH_TOKEN: "${{ github.token }}",
      HEAD_SHA: "${{ github.event.pull_request.head.sha || github.sha }}",
      RUN_URL:
        "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}",
    },
    steps: [
      {
        name: REVIEW_APP_AGGREGATE_JOB_NAME,
        // the needs context only interpolates inside the workflow file,
        // so this script stays inline
        run: [
          `results='\${{ toJSON(needs) }}'`,
          `echo "$results"`,
          `if echo "$results" | grep -qE '"result": "(failure|cancelled|skipped)"'; then`,
          `  state=failure; description="the review apps did not deploy and verify"`,
          `else`,
          `  state=success; description="review apps deployed and verified"`,
          `fi`,
          `gh api "repos/$GITHUB_REPOSITORY/statuses/$HEAD_SHA" -f state="$state" -f context="${REVIEW_APP_STATUS_CONTEXT}" -f description="$description" -f target_url="$RUN_URL" > /dev/null`,
          `echo "$description"`,
          `[ "$state" = success ]`,
        ].join("\n"),
        shell: "bash",
      },
    ],
  },
});

/** a checkout of just the materialized catci */
const catciCheckout = (): GithubStep => ({
  name: "Checkout",
  uses: "actions/checkout@v4",
  with: { "sparse-checkout": GENERATED_CATCI_FOLDER },
});

/**
 * one deploy/stop of a PR's review apps at a time, the newest wins —
 * shared by the deploy and the stop workflow, so closing a PR or
 * switching the label off cancels a deploy in flight before tearing
 * down. Events that don't concern the review apps get a group of
 * their own, so they never cancel anything.
 */
const reviewDeployConcurrency = (relevantEvent: string) => ({
  group: `catladder-review-deploy-\${{ ${PR_NUMBER_EXPRESSION} }}\${{ !(${relevantEvent}) && format('-ignored-{0}', github.run_id) || '' }}`,
  "cancel-in-progress": true,
});

/**
 * the last job of the review workflow: once it is green, dispatch the
 * review deploy workflow when the label/draft policy says this PR
 * deploys (read fresh from the PR, so a label set while CI ran counts).
 * Only for policies that deploy on their own — `deploy: "manual"` waits
 * for an explicit dispatch.
 */
export const makeReviewDeployTriggerJob = (
  reviewApps: ResolvedReviewAppsConfig,
  /** the review workflow deployed itself when this held at its start */
  inRunCondition?: string,
): Record<string, GithubJob> =>
  reviewApps.deploy === "manual"
    ? {}
    : {
        [TRIGGER_JOB_ID]: {
          name: "▶️ trigger review deploy",
          "runs-on": "ubuntu-latest",
          needs: [AGGREGATE_CHECK_JOB_ID],
          ...(inRunCondition
            ? { if: `\${{ success() && !(${inRunCondition}) }}` }
            : {}),
          permissions: {
            contents: "read",
            "pull-requests": "read",
            actions: "write",
          },
          env: {
            GITHUB_TOKEN: "${{ github.token }}",
            CL_REVIEW_APPS: JSON.stringify(reviewApps),
            CL_HEAD_REF: "${{ github.head_ref }}",
            CL_HEAD_SHA: "${{ github.event.pull_request.head.sha }}",
          },
          steps: [
            catciCheckout(),
            {
              name: "▶️ trigger review deploy",
              run: `node ${CATCI} review-app github-trigger`,
              shell: "bash",
            },
          ],
        },
      };

/**
 * the review stop workflow under a label policy: switching the label
 * off (opt-in: removing it, opt-out: adding the skip label) stops the
 * review apps, like closing the PR does. It shares the deploy
 * workflow's concurrency group, so a deploy in flight is cancelled
 * first.
 */
export const withReviewStopSwitch = (
  workflow: GithubWorkflow,
  reviewApps: ResolvedReviewAppsConfig,
  /** the review workflow deploys itself (see getInRunDeployCondition) */
  reviewRunDeploys = false,
): GithubWorkflow => {
  const switchLabel = getReviewAppsSwitchLabel(reviewApps);
  const relevantEvent = [
    "github.event_name == 'workflow_dispatch'",
    "github.event.action == 'closed'",
    ...(switchLabel
      ? [
          `(github.event.action == ${literal(switchLabel.stopOn)} && github.event.label.name == ${literal(switchLabel.label)})`,
        ]
      : []),
  ].join(" || ");
  return {
    ...workflow,
    on: {
      ...workflow.on,
      pull_request: {
        types: ["closed", ...(switchLabel ? [switchLabel.stopOn] : [])],
      },
    },
    concurrency: reviewDeployConcurrency(relevantEvent),
    jobs: Object.fromEntries(
      Object.entries({
        ...(reviewRunDeploys ? makeCancelReviewRunsJob() : {}),
        ...Object.fromEntries(
          Object.entries(workflow.jobs).map(([id, job]) => [
            id,
            // the teardown waits until no review run deploys anymore
            reviewRunDeploys && !id.startsWith("catladder-image-")
              ? {
                  ...job,
                  needs: [CANCEL_REVIEW_RUNS_JOB_ID, ...(job.needs ?? [])],
                }
              : job,
          ]),
        ),
      }).map(([id, job]) => [
        id,
        switchLabel ? { ...job, if: andIf(job.if, relevantEvent) } : job,
      ]),
    ),
  };
};

const CANCEL_REVIEW_RUNS_JOB_ID = "catladder-wait-review-runs";

/**
 * the review workflow deploys review apps itself, outside the deploy /
 * stop concurrency group — a teardown would race a deploy still running
 * there (the deploy finishing after the stop leaves the app and its
 * database behind). So the stop first waits for the PR's unfinished
 * review runs to end — cancelling them when the PR was closed, letting
 * them finish when only the label was switched off (their CI still
 * counts). Never fails: a stuck run must not keep the teardown from
 * running (it gives up after 30 minutes).
 */
const makeCancelReviewRunsJob = (): Record<string, GithubJob> => ({
  [CANCEL_REVIEW_RUNS_JOB_ID]: {
    name: "wait for running review deploys",
    "runs-on": "ubuntu-latest",
    permissions: { actions: "write", "pull-requests": "read" },
    env: { GH_TOKEN: "${{ github.token }}" },
    steps: [
      {
        name: "wait for running review deploys",
        run: [
          `branch=$(gh pr view "$CL_PR_NUMBER" -R "$GITHUB_REPOSITORY" --json headRefName -q .headRefName) || exit 0`,
          `runs=$(gh run list -R "$GITHUB_REPOSITORY" --workflow catladder-review.yml --branch "$branch" --limit 20 --json databaseId,status -q '.[] | select(.status != "completed") | .databaseId') || exit 0`,
          `# a closed PR's CI is worthless: cancel it. Otherwise let the`,
          `# PR's CI finish (cancelling it would leave catladder ✅ red)`,
          `if [ "$(jq -r '.action // ""' "$GITHUB_EVENT_PATH")" = closed ]; then`,
          `  for id in $runs; do echo "cancelling review run $id"; gh run cancel "$id" -R "$GITHUB_REPOSITORY" || true; done`,
          `fi`,
          `for id in $runs; do`,
          `  echo "waiting for review run $id"`,
          `  for _ in $(seq 1 360); do`,
          `    [ "$(gh run view "$id" -R "$GITHUB_REPOSITORY" --json status -q .status)" = completed ] && break`,
          `    sleep 5`,
          `  done`,
          `done`,
          `exit 0`,
        ].join("\n"),
        shell: "bash",
      },
    ],
  },
});

/**
 * `drafts: "skip"`: draft PRs run nothing — every job of the review
 * workflow skips them, and marking the PR ready starts the run. A
 * skipped `catladder ✅` can't let a draft through: drafts can't be
 * merged.
 */
export const withDraftsSkipped = (workflow: GithubWorkflow): GithubWorkflow => {
  const on = workflow.on as { pull_request: { types: string[] } };
  return {
    ...workflow,
    on: {
      ...workflow.on,
      pull_request: {
        ...on.pull_request,
        types: [...on.pull_request.types, "ready_for_review"],
      },
    },
    jobs: Object.fromEntries(
      Object.entries(workflow.jobs).map(([id, job]) => [
        id,
        { ...job, if: andIf(job.if, "!github.event.pull_request.draft") },
      ]),
    ),
  };
};
