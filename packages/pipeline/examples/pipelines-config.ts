import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",

  // declares which CI systems to generate pipelines for.
  // Multiple types can be enabled at the same time (e.g. during a
  // step-by-step migration from one CI system to another); each
  // generates its own set of files.
  pipelines: {
    gitlab: true,
    // per-pipeline-type options: gitRemote, and runnerVariables applied
    // to every job of this pipeline type only (e.g. a lower turbo
    // concurrency for github's small hosted runners)
    github: {
      runnerVariables: {
        TURBO_CONCURRENCY: "2",
      },
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
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Pipelines Config",
};
