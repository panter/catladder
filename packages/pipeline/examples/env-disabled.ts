import type { Config } from "../src";

/**
 * disabling an environment for the whole project: `environments.stage:
 * false` removes stage from every component — no stage jobs or
 * workflows, no setup contexts, no secrets. A per-component config of
 * the disabled env (here `api`'s `env.stage`) is ignored.
 *
 * Compare with `environments.<name>.on: false`, which keeps the env
 * (setup, secrets, catenv) and only never deploys it from a pipeline,
 * and with `components.<c>.env.<name>: false`, which removes the env for
 * that one component only.
 */
const config: Config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    gitlab: true,
    github: true,
  },
  environments: {
    stage: false,
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
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
      },
      env: {
        stage: {
          vars: { public: { IGNORED: "because stage is disabled" } },
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "Custom: Disable an environment project-wide",
};
