import type { TestJobCustom } from "../build/types";
import type { Services } from "../types/gitlab-ci-yml";

/**
 * a test job that runs after the build, against the build output, and
 * blocks the deploy when it fails (e.g. an e2e suite against the
 * production build with a database service)
 */
export type PostBuildTestConfig = TestJobCustom & {
  /**
   * command(s) to run, in the build directory (component dir, or the
   * workspace dir for workspace builds). The build artifacts (e.g.
   * `dist`, `.next`) are already in place and dependencies are
   * installed for node builds.
   *
   * The command is responsible for starting the app if it needs one,
   * e.g. via playwright's `webServer` option running `next start`.
   */
  command: string | string[];

  /**
   * services the job needs, e.g. a database:
   *
   * ```ts
   * services: [{
   *   name: "postgres:17",
   *   alias: "postgres",
   *   variables: { POSTGRES_PASSWORD: "postgres" },
   * }]
   * ```
   *
   * The service is reachable by its alias as hostname. On github,
   * `command` and `entrypoint` of a service are not supported.
   */
  services?: Services;

  /**
   * variables for this job, e.g. `DATABASE_URL` pointing to a service
   * or `BASE_URL` for the test runner.
   *
   * The job gets the build vars of the component (like the build and
   * test jobs), but not the runtime vars and secrets of the deployed
   * environment: post-build tests run before the deploy, also for
   * merge requests, and should use their own services.
   */
  vars?: Record<string, string>;
};

/**
 * named post-build tests: each entry becomes its own job in the
 * `post-build` stage. Set an entry to `false` to disable it (e.g. in an
 * env-specific override).
 */
export type PostBuildTestsConfig = Record<string, PostBuildTestConfig | false>;

export type WithPostBuildTests = {
  /**
   * tests that run after the build against the build output, in the
   * `post-build` stage between build and deploy. A failing post-build
   * test blocks the deploy.
   *
   * Each entry becomes its own job, e.g. `{ e2e: { command: "pnpm test:e2e" } }`.
   * Post-build tests don't run in tagged-release pipelines (like lint and test).
   */
  postBuildTests?: PostBuildTestsConfig;
};
