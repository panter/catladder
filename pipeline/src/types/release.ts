export type ReleaseConfig = {
  /**
   * Whether to release automatically or manually on main branch.
   * Defaults to "manuel"
   */
  when?: "manual" | "auto";
};
