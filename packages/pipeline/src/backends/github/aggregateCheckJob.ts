import type { GithubJob } from "../../types/github-types";

export const AGGREGATE_CHECK_JOB_ID = "catladder-ok";
export const AGGREGATE_CHECK_JOB_NAME = "catladder ✅";

/**
 * one job that succeeds exactly when every other job of the review
 * workflow succeeded — the single, STABLE required-status context for
 * branch protection.
 *
 * Requiring the real job names instead goes stale on every component
 * change: a renamed required job never reports on the very PR that
 * renames it ("Expected — waiting for status", unmergeable), and a new
 * component's jobs are silently not required at all. This job's `needs`
 * are regenerated with the workflow, so protection stays correct with
 * a single one-time setup.
 *
 * Semantics:
 * - `if: always()` — the job must run (and fail) when an ancestor
 *   failed; without it a failed need would leave it skipped, and a
 *   skipped required check blocks the merge with no explanation.
 * - a skipped need counts as failure: review jobs are unconditional,
 *   so skipped always means "an ancestor failed".
 * - `continue-on-error` jobs (security audit, changeset check) report
 *   `success` to `needs` even when red, so they stay non-blocking here
 *   by the same mechanism that keeps their workflow green.
 */
export const makeAggregateCheckJob = (
  reviewJobs: Record<string, GithubJob>,
): Record<string, GithubJob> => ({
  [AGGREGATE_CHECK_JOB_ID]: {
    name: AGGREGATE_CHECK_JOB_NAME,
    "runs-on": "ubuntu-latest",
    needs: Object.keys(reviewJobs).sort(),
    if: "always()",
    steps: [
      {
        name: AGGREGATE_CHECK_JOB_NAME,
        // the needs context only interpolates inside the workflow file,
        // so this script stays inline
        run: [
          `results='\${{ toJSON(needs) }}'`,
          `echo "$results"`,
          `if echo "$results" | grep -qE '"result": "(failure|cancelled|skipped)"'; then`,
          `  echo "a required job did not succeed"; exit 1`,
          `fi`,
        ].join("\n"),
        shell: "bash",
      },
    ],
  },
});
