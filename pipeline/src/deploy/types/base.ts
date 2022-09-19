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
};

export type AllowUnknownProps<T extends Record<string, unknown>> = T &
  Record<string, unknown>;
