import type { Config } from "../src";

/**
 * explicit environment configuration: the top-level `environments`
 * config declares envs project-wide and controls when they deploy
 * (`on`) and their `autoStop`; components only carry per-component
 * overrides. Deploy-level policy like cloud run's `revisionsToKeep`
 * lives in the deploy config.
 *
 * The env type only supplies defaults — everything here overrides them:
 * - review keeps its MR trigger but auto-stops after 3 days (default 1 week)
 * - dev never auto-stops for the www component (default 4 weeks)
 * - prod keeps only 2 rollback revisions (default 5)
 * - `next` is a stable extra env deploying on pushes to the `next`
 *   branch; every component deploys to it (opt out with `env.next: false`)
 */
const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    gitlab: true,
    github: true,
  },
  environments: {
    review: {
      autoStop: "3 days",
    },
    next: {
      type: "dev",
      on: { branch: "next" },
    },
  },
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
      },
      env: {
        dev: {
          autoStop: false,
        },
        prod: {
          deploy: {
            revisionsToKeep: 2,
          },
        },
      },
    },
  },
} satisfies Config<{ CustomEnvs: "next" }>;

export default config;

export const information = {
  title: "Custom: Env triggers and autoStop",
};
