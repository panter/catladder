import type { Config } from "../src";

/**
 * environment inheritance: `next` is a stable env deploying on pushes
 * to the `next` branch that behaves like dev — `inherit: "dev"` gives
 * it dev's per-component config overrides (below its own) AND dev's
 * secret values (all-or-nothing: its jobs reference the `CL_DEV_*`
 * variables, there is no separate `next` secret store).
 *
 * The env type is implied by the inheritance (dev), so `type` can be
 * omitted.
 */
const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    gitlab: true,
    github: true,
  },
  environments: {
    next: {
      on: { branch: "next" },
      inherit: "dev",
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
        cloudSql: {
          type: "unmanaged",
          instanceConnectionName: "google-project-id:europe-west6:db",
        },
      },
      vars: {
        public: { API_URL: "https://api.example.com" },
        secret: { API_KEY: "secret" },
      },
      env: {
        dev: {
          vars: { public: { FEATURE_FLAGS: "beta-features" } },
        },
      },
    },
  },
} satisfies Config<{ CustomEnvs: "next" }>;

export default config;

export const information = {
  title: "Custom: Env inheritance",
};
