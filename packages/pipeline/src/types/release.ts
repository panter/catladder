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
};
