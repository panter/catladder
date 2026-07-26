import type { EnvVars } from "../../types/config";
import type { DeployConfigBaseExecute } from "./executeBase";

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
   * vars that only exist in the deploy job.
   * Can curently not reference other variables from other components
   */
  jobVars?: EnvVars;

  /**
   * additional vars only for the runner.
   * Also if you use services: that require env vars, you need to set them here.
   *
   */
  runnerVariables?: Record<string, string>;

  /**
   * whether the pipeline may continue when this deploy fails
   * (gitlab allow_failure)
   */
  allowFailure?: boolean;
};

export type AllowUnknownProps<T extends Record<string, unknown>> = T &
  Record<string, unknown>;
