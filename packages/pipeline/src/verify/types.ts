import type { TestJobCustom } from "../build/types";

/**
 * post-deploy verification job configuration
 */
export type VerifyConfig = TestJobCustom & {
  /**
   * command(s) to run against the deployed environment (e.g. `yarn e2e`).
   * Runs in the component's directory.
   */
  command: string | string[];

  /**
   * names of other components whose deploy must finish before this verify job runs
   * (in addition to this component's own deploy, which is always awaited)
   */
  waitFor?: string[];
};
