import type { GitlabJobDef } from "../../types";

/**
 * the jobs the queued-release executor must `needs:` so that it runs
 * exactly when the whole main-branch pipeline succeeded.
 *
 * `needs:` is transitive: a job that another automatic job needs is
 * already awaited through that job, and a failed ancestor skips its
 * descendants (and with them the executor) either way. The executor
 * therefore only needs the SINKS of the auto-job graph — the jobs no
 * other automatic job depends on (deploy/verify tips, terminal
 * test/lint/audit). This keeps the needs list far below gitlab's
 * 50-entry cap even on pipelines with many components.
 *
 * INVARIANT (do not weaken): every automatic job is an ancestor of the
 * returned set. This holds for ANY graph shape, because the sinks are
 * recomputed from the actual needs edges on every generation — if e.g.
 * deploys ever stop needing the test jobs, the test jobs become sinks
 * and re-enter the executor's needs by themselves. Only needs FROM
 * automatic jobs count: a job consumed solely by manual jobs is a sink
 * too, and keeps gating the release directly.
 */
export const getReleaseGateJobNames = (
  autoJobs: Array<{ name: string; gitlabJob: Pick<GitlabJobDef, "needs"> }>,
): string[] => {
  const neededByAnAutoJob = new Set(
    autoJobs.flatMap(({ gitlabJob }) =>
      (gitlabJob.needs ?? []).map((need) =>
        typeof need === "string" ? need : need.job,
      ),
    ),
  );
  return [...new Set(autoJobs.map(({ name }) => name))].filter(
    (name) => !neededByAnAutoJob.has(name),
  );
};
