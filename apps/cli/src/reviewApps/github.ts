/**
 * the review deploy switch on github (see the pipeline's
 * `reviewApps.ts` and `backends/github/reviewDeployWorkflow.ts`).
 *
 * github runs can't pause for a click, so the switch is a workflow of
 * its own, `▶️ catladder deploy review`, holding the review delivery
 * chains (docker → deploy → verify) behind a guard:
 *
 * - `github-trigger` is the last job of the review workflow: once the
 *   PR's CI is green it reads the PR fresh (labels, draft) and
 *   dispatches the deploy workflow when the policy says it deploys
 * - `github-guard` is the first job of the deploy workflow and decides
 *   whether the run deploys (`deploy` step output):
 *   - source `manual` (a dispatch by a human or agent): always,
 *     provided the PR is open and its CI is green
 *   - source `ci` (dispatched by the trigger) and `label` (the switch
 *     label changed / a draft was marked ready): when the policy says
 *     so — and the CI is green. A label switched on while CI still runs
 *     is no deploy here: the trigger picks it up once CI is green.
 */
import {
  type ResolvedReviewAppsConfig,
  shouldAutoDeployReviewApps,
} from "../../../../packages/pipeline/src/reviewAppsPolicy";
import { appendFileSync } from "fs";
import { appendStepSummary, workflowLink } from "../release/stepSummary";

/**
 * the generated review deploy workflow. Keep in sync with
 * REVIEW_DEPLOY_WORKFLOW_FILE in
 * packages/pipeline/src/backends/github/reviewDeployWorkflow.ts.
 */
const GITHUB_REVIEW_DEPLOY_WORKFLOW = "catladder-deploy-review.yml";

/**
 * the review workflow's aggregate job — its check run says whether the
 * PR's CI is green. Keep in sync with AGGREGATE_CHECK_JOB_NAME in
 * packages/pipeline/src/backends/github/aggregateCheckJob.ts.
 */
const AGGREGATE_CHECK_NAME = "catladder ✅";

type PullRequest = {
  number: number;
  state: string;
  draft: boolean;
  labels: Array<{ name: string }>;
  head: { sha: string; ref: string };
};

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const setStepOutput = (name: string, value: string) => {
  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    appendFileSync(file, `${name}=${value}\n`);
  }
};

const getReviewAppsConfig = (): ResolvedReviewAppsConfig =>
  JSON.parse(requireEnv("CL_REVIEW_APPS"));

const githubApi = async (path: string, init: RequestInit = {}) => {
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const repository = requireEnv("GITHUB_REPOSITORY");
  return fetch(`${apiUrl}/repos/${repository}/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${requireEnv("GITHUB_TOKEN")}`,
      accept: "application/vnd.github+json",
      ...init.headers,
    },
  });
};

const getPullRequest = async (prNumber: string): Promise<PullRequest> => {
  const response = await githubApi(`pulls/${prNumber}`);
  if (!response.ok) {
    throw new Error(
      `reading pull request #${prNumber} failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as PullRequest;
};

/**
 * the newest `catladder ✅` check run of a commit — null while the
 * review workflow hasn't reported yet
 */
const getAggregateCheck = async (
  sha: string,
): Promise<{ status: string; conclusion: string | null } | null> => {
  const response = await githubApi(
    `commits/${sha}/check-runs?check_name=${encodeURIComponent(AGGREGATE_CHECK_NAME)}&filter=latest`,
  );
  if (!response.ok) {
    throw new Error(
      `reading the checks of ${sha} failed: ${response.status} ${await response.text()}`,
    );
  }
  const data = (await response.json()) as {
    check_runs?: Array<{
      id: number;
      status: string;
      conclusion: string | null;
    }>;
  };
  const [newest] = [...(data.check_runs ?? [])].sort((a, b) => b.id - a.id);
  return newest ?? null;
};

const short = (sha: string) => sha.slice(0, 7);

const mrState = (pr: PullRequest) => ({
  labels: pr.labels.map((label) => label.name),
  draft: pr.draft,
});

/**
 * `catci review-app github-guard` — first job of the review deploy
 * workflow, sets the `deploy` step output
 */
export const githubReviewDeployGuardJob = async () => {
  const config = getReviewAppsConfig();
  const prNumber = requireEnv("CL_PR_NUMBER");
  const source = process.env.CL_DEPLOY_SOURCE || "manual";
  const headSha = requireEnv("CL_HEAD_SHA");
  const explicit = source === "manual";

  const skip = (message: string) => {
    console.log(`not deploying: ${message}`);
    appendStepSummary(`⏭️ **Not deploying** the review apps: ${message}`);
    setStepOutput("deploy", "false");
  };
  // an explicit request that can't be served is an error, an automatic
  // one simply doesn't deploy
  const refuse = (message: string) => {
    if (explicit) {
      appendStepSummary(`❌ **Can't deploy** the review apps: ${message}`);
      setStepOutput("deploy", "false");
      fail(`can't deploy the review apps: ${message}`);
    }
    skip(message);
  };

  const pr = await getPullRequest(prNumber);
  if (pr.state !== "open") {
    return refuse(`pull request #${pr.number} is ${pr.state}`);
  }
  let reason = "requested explicitly";
  if (!explicit) {
    const decision = shouldAutoDeployReviewApps(config, mrState(pr));
    if (!decision.deploy) {
      return skip(decision.reason);
    }
    reason = decision.reason;
  }
  if (pr.head.sha !== headSha) {
    return refuse(
      explicit
        ? `this run is for ${short(headSha)}, but #${pr.number}'s head is ${short(pr.head.sha)} — dispatch the workflow from the pull request's branch ('${pr.head.ref}')`
        : `#${pr.number} moved on to ${short(pr.head.sha)} — its own review run decides`,
    );
  }
  const check = await getAggregateCheck(headSha);
  if (!check || check.status !== "completed") {
    return refuse(
      `the CI of ${short(headSha)} (${AGGREGATE_CHECK_NAME}) is not finished yet` +
        (explicit
          ? " — dispatch again once it is green"
          : " — the review workflow starts the deploy once it is green"),
    );
  }
  if (check.conclusion !== "success") {
    return refuse(
      `the CI of ${short(headSha)} (${AGGREGATE_CHECK_NAME}) concluded '${check.conclusion}'`,
    );
  }
  console.log(
    `deploying the review apps of #${pr.number} (${short(headSha)}): ${reason}`,
  );
  appendStepSummary(
    `🚀 **Deploying** the review apps of #${pr.number} (\`${short(headSha)}\`): ${reason}.`,
  );
  setStepOutput("deploy", "true");
};

/**
 * `catci review-app github-trigger` — last job of the review workflow:
 * dispatches the review deploy workflow when the PR deploys
 */
export const githubReviewDeployTriggerJob = async () => {
  const config = getReviewAppsConfig();
  const prNumber = requireEnv("CL_PR_NUMBER");
  const headRef = requireEnv("CL_HEAD_REF");
  const headSha = requireEnv("CL_HEAD_SHA");

  const pr = await getPullRequest(prNumber);
  if (pr.head.sha !== headSha) {
    console.log(
      `#${pr.number} moved on to ${short(pr.head.sha)} — its own review run decides`,
    );
    return;
  }
  const decision = shouldAutoDeployReviewApps(config, mrState(pr));
  if (!decision.deploy) {
    console.log(`not deploying the review apps: ${decision.reason}`);
    appendStepSummary(
      `⏭️ Review apps not deployed: ${decision.reason}. ` +
        `Deploy anyway: \`gh workflow run ${GITHUB_REVIEW_DEPLOY_WORKFLOW} --ref ${headRef} -f pr=${pr.number}\``,
    );
    return;
  }
  const response = await githubApi(
    `actions/workflows/${GITHUB_REVIEW_DEPLOY_WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ref: headRef,
        inputs: { pr: String(pr.number), source: "ci" },
      }),
    },
  );
  if (response.status === 404) {
    // github only dispatches workflows that exist on the default branch
    const message = `the ${GITHUB_REVIEW_DEPLOY_WORKFLOW} workflow is not on the default branch yet — review apps deploy automatically once this change is merged`;
    console.log(`::warning::${message}`);
    appendStepSummary(`⚠️ ${message}`);
    return;
  }
  if (!response.ok) {
    fail(
      `dispatching ${GITHUB_REVIEW_DEPLOY_WORKFLOW} failed: ${response.status} ${await response.text()}`,
    );
  }
  console.log(
    `review deploy dispatched for #${pr.number} (${short(headSha)}): ${decision.reason}`,
  );
  appendStepSummary(
    `▶️ **Review deploy started** for #${pr.number} (\`${short(headSha)}\`): ${decision.reason} — see ${workflowLink(GITHUB_REVIEW_DEPLOY_WORKFLOW, "catladder deploy review")}.`,
  );
};
