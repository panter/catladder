/**
 * how releases are created:
 * - "semantic-release" (default): the version is derived automatically
 *   from conventional commit messages since the last release
 * - "changesets": developers declare changes intentionally as
 *   `.changeset/*.md` files (bump type + human-written summary,
 *   official changesets format); the release job consumes them and
 *   derives the version from the last `v*` git tag
 *
 * Both methods gate on the security audit, commit a changelog and push
 * a `vX.Y.Z` tag that triggers the taggedRelease pipeline.
 */
export type ReleaseMethod = "semantic-release" | "changesets";

export type ReleaseConfig = {
  /**
   * Whether to release automatically or manually on main branch.
   * - "manual" (default): the pipeline offers a `create release`
   *   button that can be clicked at any time — the release then runs
   *   automatically as soon as every other job of the pipeline
   *   succeeded (clicking after a green pipeline releases right away).
   *   A `force create release` button releases immediately, ignoring
   *   the pipeline state.
   * - "auto": every main-branch pipeline releases at the end.
   */
  when?: "manual" | "auto";
  /**
   * how the release version and changelog are created.
   * Defaults to "semantic-release".
   */
  method?: ReleaseMethod;
  /**
   * github only, manual releases only: release a commit only when an
   * external result for exactly that commit is green — e.g. an e2e suite
   * that runs in its own workflow after the main workflow deployed dev
   * (outside the main workflow, so the next deploy never waits for it).
   *
   * - `create release` on a commit whose result is pending queues the
   *   release; it runs once the main workflow and the result are green
   * - a red result, or none at all, does not release (queue again once
   *   a commit has a green result, or force the release)
   * - the release runs only when the main branch still points at the
   *   gated commit
   *
   * The force checkbox of `create release` skips the gate.
   */
  requireStatus?: ReleaseRequiredStatus;
};

export type ReleaseRequiredStatus = {
  /**
   * the commit status context (or check run name) that must be green,
   * e.g. "e2e-main"
   */
  context: string;
  /**
   * the name of the workflow that reports it (its `name:`), e.g.
   * "🔬 e2e main". Its completion triggers the queued-release check:
   * statuses written with the workflow token trigger no workflow
   * themselves.
   */
  workflow: string;
};
