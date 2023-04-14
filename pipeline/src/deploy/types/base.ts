export type DeployConfigBase = {
  /**
   * whether to deploy automatically or manual. If not defined, these rules apply:
   * - prod: manual
   * - all other envs: auto
   */
  when?: "manual" | "auto";

  /**
   * EXPERIMENTAL
   * wait for other components to deploy first, before doing this deployment
   */
  waitFor?: string[];

  /**
   * tags for the underlying job runner (e.g gitlab)
   */
  jobTags?: string[];

  /**
   * additional env vars for the deploy job
   */
  extraVars?: Record<string, string>;
};

export type AllowUnknownProps<T extends Record<string, unknown>> = T &
  Record<string, unknown>;
