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

const getMainWorkflowRun = async (
  sha: string,
): Promise<{ status: string; conclusion: string | null } | null> => {
  const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
  const repository = requireEnv("GITHUB_REPOSITORY");
  const token = requireEnv("GITHUB_TOKEN");
  const response = await fetch(
    `${apiUrl}/repos/${repository}/actions/workflows/${GITHUB_MAIN_WORKFLOW}/runs?head_sha=${sha}&per_page=5`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(
      `listing ${GITHUB_MAIN_WORKFLOW} runs failed: ${response.status} ${await response.text()}`,
    );
  }
  const data = (await response.json()) as {
    workflow_runs?: Array<{ status: string; conclusion: string | null }>;
  };
  // newest first — re-runs replace older attempts
  return data.workflow_runs?.[0] ?? null;
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
  if (!run) {
    console.log(`no main workflow run found for ${sha} — releasing right away`);
    appendStepSummary(
      `ℹ️ No main workflow run found for \`${sha}\` — releasing right away.`,
    );
    setStepOutput("queued", "false");
    return;
  }
  if (run.status === "completed") {
    if (run.conclusion === "success") {
      console.log(`main workflow for ${sha} succeeded — releasing right away`);
      appendStepSummary(
        `✅ The main workflow for \`${sha}\` succeeded — releasing right away.`,
      );
      setStepOutput("queued", "false");
      return;
    }
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
  console.log(
    `main workflow for ${sha} is ${run.status} — release queued: ` +
      `the 'release on green' workflow creates the release as soon as the run succeeds`,
  );
  appendStepSummary(
    `⏳ **Release queued** for \`${sha}\` — the ${workflowLink(GITHUB_MAIN_WORKFLOW, "main workflow")} run is still ${run.status}. ` +
      `${workflowLink(GITHUB_ON_GREEN_WORKFLOW, "catladder release on green")} creates the release as soon as it succeeds.`,
  );
  setStepOutput("queued", "true");
};

/**
 * `catci release github-queued-guard <head-sha> <conclusion>` — guard
 * step of the release-on-green workflow, running on every completed
 * main workflow run. Consumes the marker when it matches the run and
 * decides whether the release step runs (release=true).
 */
export const githubQueuedGuardJob = async (
  headSha: string,
  conclusion: string,
) => {
  await ensureGitSafeDirectory();
  const markerLine = await git("ls-remote", "origin", QUEUE_MARKER_REF);
  const marker = markerLine.split(/\s+/)[0] ?? "";
  if (!marker) {
    console.log("no release queued — nothing to do");
    appendStepSummary("No release queued — nothing to do.");
    setStepOutput("release", "false");
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
  // consume the marker either way: the queued intent applied to exactly
  // this run, whatever its outcome
  await git("push", "origin", `:${QUEUE_MARKER_REF}`);
  if (conclusion !== "success") {
    appendStepSummary(
      `❌ Queued release for \`${headSha}\` **not executed**: the main workflow concluded **${conclusion}**. ` +
        `Fix the pipeline and queue again via the 🚀 create release workflow.`,
    );
    fail(
      `queued release not executed: the main workflow concluded '${conclusion}' — ` +
        `fix the pipeline and queue the release again`,
    );
  }
  console.log(`main workflow for ${headSha} succeeded — releasing`);
  appendStepSummary(
    `✅ Main workflow for \`${headSha}\` succeeded — running the queued release.`,
  );
  setStepOutput("release", "true");
};
