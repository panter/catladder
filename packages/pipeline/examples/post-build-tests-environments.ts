import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  builds: {
    base: {
      type: "node",
      postBuildTests: {
        // fast smoke tests on every merge/pull request and on main
        smoke: { command: "yarn test:smoke" },
        // the full e2e suite only on the main branch (dev env), not on
        // every merge/pull request push
        e2e: { command: "yarn test:e2e", environments: ["dev"] },
      },
    },
  },
  components: {
    web: {
      dir: "web",
      build: { from: "base" },
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
  title: "Post-build tests limited to environments",
  description:
    "A post-build test with `environments` runs only in the listed envs, e.g. the full e2e suite only on the main branch.",
};
