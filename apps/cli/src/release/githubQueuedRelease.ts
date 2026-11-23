/**
 * "release once the pipeline succeeds" on github.
 *
 * gitlab expresses this natively inside the pipeline (the `create
 * release` button job plus an executor with `needs` on the whole
 * pipeline); github has no cross-workflow needs, so catladder uses a
 * marker ref plus a workflow_run-triggered workflow instead:
 *
 * - the manual `create-release` dispatch runs `github-queue-check`:
 *   - the main workflow run for HEAD completed green (or never ran) →
 *     release right away (queued=false, the job's release step runs)
 *   - still running → push the marker ref and stop (queued=true skips
 *     the release step); the release-on-green workflow takes over
 *   - completed red → fail with a pointer to the force task
 * - the release-on-green workflow (`on: workflow_run` of the main
 *   workflow) runs `github-queued-guard` on every completed main run:
 *   it consumes the marker when it matches the run's head sha and
 *   releases only when the run concluded green
 * - a run that was cancelled because a newer main run replaced it
 *   (`pipelines.github.concurrency.main`) hands the marker on to the
 *   newer main head instead of dropping the release: the release then
 *   follows that head's run (see `handOverCancelledRun`)
 *
 * - with `releases.requireStatus`, a commit is releasable only once an
 *   external result (a commit status / check run, e.g. an e2e suite in
 *   its own workflow after the dev deploy) is green for exactly that
 *   commit; the guard also runs when that workflow completes
 *
 * Every guard change to the marker is a compare-and-swap
 * (`--force-with-lease`): guards of different runs race, and only the
 * one whose expectation still holds may consume the marker — a queued
 * release runs at most once.
 */
import { appendFileSync } from "fs";
import { git } from "./releaseGit";
import { appendStepSummary, workflowLink } from "./stepSummary";

/**
 * the generated main-branch workflow whose runs gate a queued release.
 * Keep in sync with `workflowFileName` / GENERATED_FILE_PREFIX in
 * pipeline/src/backends/github/GithubBackend.ts.
 */
const GITHUB_MAIN_WORKFLOW = "catladder-main.yml";

/**
 * the workflow that picks up a queued release, for summary links. Keep
 * in sync with the release-on-green file name in
 * pipeline/src/backends/github/GithubBackend.ts.
 */
const GITHUB_ON_GREEN_WORKFLOW = "catladder-release-on-green.yml";

/**
 * where a queued release is recorded: a ref outside refs/heads and
 * refs/tags, pointing at the commit the release was queued for.
 * Writable with the job token (`permissions: contents: write`).
 */
const QUEUE_MARKER_REF = "refs/catladder/release-queued";

/**
 * the branch the main workflow runs on. Keep in sync with
 * TRIGGER_WORKFLOWS.mainBranch in
 * pipeline/src/backends/github/GithubBackend.ts.
 */
const MAIN_BRANCH_REF = "refs/heads/main";

/**
 * github container jobs: the workspace volume is owned by the host
 * runner user while catci runs as the container user — git refuses the
 * repo ("dubious ownership") without a safe.directory entry. The
 * release entrypoint scripts do the same, but the queue commands run
 * before them.
 */
const ensureGitSafeDirectory = async () => {
  await git("config", "--global", "--add", "safe.directory", process.cwd());
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

/**
 * step outputs of the github-actions step running the command
 * (`$GITHUB_OUTPUT` is always set in workflow steps)
 */
const setStepOutput = (name: string, value: string) => {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    return;
  }
  appendFileSync(file, `${name}=${value}\n`);
};

const githubApi = async <T>(path: string, what: string): Promise<T> => {
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const repository = requireEnv("GITHUB_REPOSITORY");
  const token = requireEnv("GITHUB_TOKEN");
  const response = await fetch(`${apiUrl}/repos/${repository}/${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
    },
  });
  if (!response.ok) {
    throw new Error(
      `${what} failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
};

type WorkflowRun = { status: string; conclusion: string | null };

const getMainWorkflowRun = async (sha: string): Promise<WorkflowRun | null> => {
  const data = await githubApi<{ workflow_runs?: WorkflowRun[] }>(
    `actions/workflows/${GITHUB_MAIN_WORKFLOW}/runs?head_sha=${sha}&per_page=5`,
    `listing ${GITHUB_MAIN_WORKFLOW} runs`,
  );
  // newest first — re-runs replace older attempts
  return data.workflow_runs?.[0] ?? null;
};

/**
 * whether `descendant` contains `ancestor` — asked github instead of
 * the local clone, which is shallow in the guard job
 */
const isAncestor = async (ancestor: string, descendant: string) => {
  const data = await githubApi<{ status: string }>(
    `compare/${ancestor}...${descendant}`,
    `comparing ${ancestor}...${descendant}`,
  );
  return data.status === "ahead" || data.status === "identical";
};

const readRemoteRef = async (ref: string) =>
  (await git("ls-remote", "origin", ref)).split(/\s+/)[0] ?? "";

/**
 * compare-and-swap of the marker: points it at `next` (or deletes it)
 * only while it still points at `expected`. False when another guard
 * changed it first.
 */
const swapMarker = async (expected: string, next: string | null) => {
  try {
    await git(
      "push",
      `--force-with-lease=${QUEUE_MARKER_REF}:${expected}`,
      "origin",
      next ? `${next}:${QUEUE_MARKER_REF}` : `:${QUEUE_MARKER_REF}`,
    );
    return true;
  } catch (error) {
    console.log(
      `the queued release changed meanwhile — leaving it to the other guard (${error})`,
    );
    return false;
  }
};

/**
 * `releases.requireStatus`, handed over by the generated workflow. Keep
 * the names in sync with pipeline/src/release/index.ts.
 */
const getReleaseGate = () => {
  const context = process.env.CATLADDER_RELEASE_REQUIRED_STATUS;
  const workflow = process.env.CATLADDER_RELEASE_GATE_WORKFLOW;
  return context && workflow ? { context, workflow } : null;
};

type GateState = "green" | "red" | "pending" | "missing";

/**
 * the state of the required result for exactly `sha`: a commit status
 * with that context, or else a check run with that name (newest wins)
 */
const getGateState = async (
  sha: string,
  context: string,
): Promise<GateState> => {
  const statuses = await githubApi<Array<{ context: string; state: string }>>(
    `commits/${sha}/statuses?per_page=100`,
    `listing the statuses of ${sha}`,
  );
  const status = statuses.find((entry) => entry.context === context);
  if (status) {
    return status.state === "success"
      ? "green"
      : status.state === "pending"
        ? "pending"
        : "red";
  }
  const { check_runs: checkRuns = [] } = await githubApi<{
    check_runs?: Array<{ status: string; conclusion: string | null }>;
  }>(
    `commits/${sha}/check-runs?check_name=${encodeURIComponent(context)}&filter=latest`,
    `listing the check runs of ${sha}`,
  );
  const check = checkRuns[0];
  if (!check) return "missing";
  if (check.status !== "completed") return "pending";
  if (check.conclusion === "success") return "green";
  if (check.conclusion === "neutral" || check.conclusion === "skipped") {
    return "missing";
  }
  return "red";
};

const describeGate = (context: string, state: GateState) =>
  state === "missing"
    ? `has no \`${context}\` result`
    : state === "pending"
      ? `\`${context}\` is still pending`
      : `\`${context}\` is ${state}`;

/**
 * the main workflow for `sha` is green (or has none): release it — with
 * a release gate only once its result is green. Waits (keeps the
 * marker) while the result is pending or missing; consumes the marker
 * and fails when it is red.
 */
const releaseIfGateAllows = async (sha: string) => {
  const gate = getReleaseGate();
  const state = gate ? await getGateState(sha, gate.context) : "green";
  if (gate && (state === "pending" || state === "missing")) {
    console.log(
      `${sha}: ${describeGate(gate.context, state)} — the release waits for it`,
    );
    appendStepSummary(
      `⏳ Queued release for \`${sha}\` waits: ${describeGate(gate.context, state)} yet. ` +
        `It runs when the ${gate.workflow} workflow reports it green.`,
    );
    setStepOutput("release", "false");
    return;
  }
  if (!(await swapMarker(sha, null))) {
    setStepOutput("release", "false");
    return;
  }
  if (gate && state === "red") {
    appendStepSummary(
      `❌ Queued release for \`${sha}\` **not executed**: ${describeGate(gate.context, state)}. ` +
        `Fix forward and queue again via the 🚀 create release workflow.`,
    );
    fail(
      `queued release not executed: ${sha} ${describeGate(gate.context, state).replace(/`/g, "")} — fix forward and queue the release again`,
    );
  }
  console.log(`releasing ${sha}`);
  appendStepSummary(
    `✅ ${gate ? `\`${gate.context}\` and the main workflow are green` : "Main workflow succeeded"} for \`${sha}\` — running the queued release.`,
  );
  setStepOutput("sha", sha);
  setStepOutput("release", "true");
};

/**
 * the release gate of the create-release check, once the main workflow
 * for `sha` is green: returns false when the release may run right
 * away, queues it while the result is pending (true), fails when the
 * result is red or missing
 */
const queueForGate = async (sha: string): Promise<boolean> => {
  const gate = getReleaseGate();
  if (!gate) return false;
  const state = await getGateState(sha, gate.context);
  if (state === "green") {
    console.log(`${gate.context} is green for ${sha}`);
    appendStepSummary(`✅ \`${gate.context}\` is green for \`${sha}\`.`);
    return false;
  }
  if (state === "pending") {
    await git("push", "origin", `+${sha}:${QUEUE_MARKER_REF}`);
    console.log(
      `${gate.context} is still pending for ${sha} — release queued until it is green`,
    );
    appendStepSummary(
      `⏳ **Release queued** for \`${sha}\` — \`${gate.context}\` is still pending. ` +
        `${workflowLink(GITHUB_ON_GREEN_WORKFLOW, "release on green")} creates the release as soon as the ${gate.workflow} workflow reports it green.`,
    );
    setStepOutput("queued", "true");
    return true;
  }
  appendStepSummary(
    `❌ Not releasing: \`${sha}\` ${describeGate(gate.context, state)}. ` +
      `Release a commit whose \`${gate.context}\` is green, or re-run with the force checkbox to release anyway.`,
  );
  return fail(
    `not releasing: ${sha} ${describeGate(gate.context, state).replace(/`/g, "")} — ` +
      `release a commit whose ${gate.context} is green, or force the release`,
  );
};

/**
 * `catci release github-queue-check` — first step of the manual
 * create-release dispatch job. Decides between releasing right away
 * (queued=false) and queueing for the running main workflow
 * (queued=true).
 */
export const githubQueueCheckJob = async () => {
  await ensureGitSafeDirectory();
  const sha = await git("rev-parse", "HEAD");
  const run = await getMainWorkflowRun(sha);
  if (!run || (run.status === "completed" && run.conclusion === "success")) {
    if (await queueForGate(sha)) {
      return;
    }
    const why = run
      ? `the main workflow for \`${sha}\` succeeded`
      : `no main workflow run found for \`${sha}\``;
    console.log(`${why.replace(/`/g, "")} — releasing right away`);
    appendStepSummary(
      `${run ? "✅" : "ℹ️"} ${why.charAt(0).toUpperCase()}${why.slice(1)} — releasing right away.`,
    );
    setStepOutput("queued", "false");
    return;
  }
  if (run.status === "completed") {
    appendStepSummary(
      `❌ Not releasing: the ${workflowLink(GITHUB_MAIN_WORKFLOW, "main workflow")} run for \`${sha}\` concluded **${run.conclusion}**. ` +
        `Fix the pipeline, or re-run with the force checkbox to release anyway.`,
    );
    fail(
      `the main workflow for ${sha} concluded '${run.conclusion}' — ` +
        `fix the pipeline, or force the release to release anyway`,
    );
  }
  // queued / in_progress / waiting: record the intent and let the
  // release-on-green workflow do the release. Force-push: a re-queue
  // (or a stale marker of an older commit) just moves the marker.
  await git("push", "origin", `+${sha}:${QUEUE_MARKER_REF}`);
  const runState = run.status.replace(/_/g, " ");
  console.log(
    `main workflow for ${sha} is ${runState} — release queued: ` +
      `the 'release on green' workflow creates the release as soon as the run succeeds`,
  );
  appendStepSummary(
    `⏳ **Release queued** for \`${sha}\` — the ${workflowLink(GITHUB_MAIN_WORKFLOW, "main workflow")} run is still ${runState}. ` +
      `${workflowLink(GITHUB_ON_GREEN_WORKFLOW, "release on green")} creates the release as soon as it succeeds.`,
  );
  setStepOutput("queued", "true");
};

/**
 * `catci release github-queued-guard <head-sha> <conclusion> [<workflow>]`
 * — guard step of the release-on-green workflow, running on every
 * completed main workflow run (and, with a release gate, every
 * completed run of the gate's workflow, named by `<workflow>`).
 * Consumes the marker when it matches the run and decides whether the
 * release step runs (release=true, sha=<the released commit>).
 */
export const githubQueuedGuardJob = async (
  headSha: string,
  conclusion: string,
  workflowName?: string,
) => {
  await ensureGitSafeDirectory();
  const marker = await readRemoteRef(QUEUE_MARKER_REF);
  if (!marker) {
    console.log("no release queued — nothing to do");
    appendStepSummary("No release queued — nothing to do.");
    setStepOutput("release", "false");
    return;
  }
  const gate = getReleaseGate();
  if (gate && workflowName === gate.workflow) {
    // the gate's workflow reported (for whichever commit): re-check the
    // queued commit. Its main run's own guard handles a red main run.
    const run = await getMainWorkflowRun(marker);
    if (run && (run.status !== "completed" || run.conclusion !== "success")) {
      console.log(
        `main workflow for ${marker} is not green (yet) — leaving the queue to its guard`,
      );
      setStepOutput("release", "false");
      return;
    }
    await releaseIfGateAllows(marker);
    return;
  }
  if (marker !== headSha) {
    console.log(
      `queued release is for ${marker}, this run is for ${headSha} — leaving the queue untouched`,
    );
    appendStepSummary(
      `Queued release is for \`${marker}\`, this run is for \`${headSha}\` — leaving the queue untouched.`,
    );
    setStepOutput("release", "false");
    return;
  }
  if (conclusion === "cancelled" && (await handOverCancelledRun(headSha))) {
    return;
  }
  if (conclusion === "success") {
    await releaseIfGateAllows(headSha);
    return;
  }
  // a red run consumes the marker: the queued intent applied to exactly
  // this run
  if (!(await swapMarker(headSha, null))) {
    setStepOutput("release", "false");
    return;
  }
  failRedRun(headSha, conclusion);
};

/** fails the guard for a queued release whose main run is not green */
const failRedRun = (sha: string, conclusion: string): never => {
  appendStepSummary(
    `❌ Queued release for \`${sha}\` **not executed**: the main workflow concluded **${conclusion}**. ` +
      `Fix the pipeline and queue again via the 🚀 create release workflow.`,
  );
  return fail(
    `queued release not executed: the main workflow concluded '${conclusion}' — ` +
      `fix the pipeline and queue the release again`,
  );
};

/**
 * the main run of a queued release was cancelled. With main
 * concurrency, that is github replacing a pending run by the run of a
 * newer push — the release must not get lost with it. When the main
 * branch moved on to a commit containing the queued one, the marker
 * moves there and the release follows that commit's run:
 *
 * - still running → its own guard releases once it completes
 * - already completed (its guard ran while the marker still pointed
 *   here, and left it alone) → decide here, as that guard would have
 * - no run at all (e.g. a `[skip ci]` commit) → release right away,
 *   like the create-release check does
 *
 * Returns false when the release does not move (main did not move on,
 * e.g. a run cancelled by hand) — the guard then handles the cancelled
 * run as before: consume the marker and fail.
 */
const handOverCancelledRun = async (sha: string): Promise<boolean> => {
  const head = await readRemoteRef(MAIN_BRANCH_REF);
  if (!head || head === sha) {
    return false;
  }
  try {
    if (!(await isAncestor(sha, head))) {
      return false;
    }
  } catch (error) {
    console.log(
      `could not confirm that main (${head}) contains ${sha}: ${error}`,
    );
    return false;
  }
  if (!(await swapMarker(sha, head))) {
    setStepOutput("release", "false");
    return true;
  }
  console.log(
    `main workflow for ${sha} was cancelled and main moved on — queued release moved to ${head}`,
  );
  appendStepSummary(
    `⏭️ The ${workflowLink(GITHUB_MAIN_WORKFLOW, "main workflow")} run for \`${sha}\` was cancelled (replaced by a newer run). ` +
      `The queued release moved to \`${head}\` and follows its main workflow run.`,
  );

  const run = await getMainWorkflowRun(head);
  if (run && run.status !== "completed") {
    console.log(
      `main workflow for ${head} is ${run.status.replace(/_/g, " ")} — its guard releases once it succeeds`,
    );
    setStepOutput("release", "false");
    return true;
  }
  if (!run || run.conclusion === "success") {
    // green (or no run, e.g. a [skip ci] commit — like the
    // create-release check): its guard already ran while the marker
    // still pointed here, so decide here
    await releaseIfGateAllows(head);
    return true;
  }
  if (!(await swapMarker(head, null))) {
    // the guard of the newer run consumed it
    setStepOutput("release", "false");
    return true;
  }
  failRedRun(head, run.conclusion ?? "unknown");
  return true;
};
