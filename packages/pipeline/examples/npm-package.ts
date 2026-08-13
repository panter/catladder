import type { Config } from "../src";

/**
 * publishes a library as an npm package instead of deploying a
 * service: every trigger publishes a matching flavor of the package.
 *
 * - merge requests publish an installable canary
 *   (`0.0.0-<branch>-<sha>` under the `canary` dist-tag — or under
 *   `next`/`beta` when the branch is named like that)
 * - tagged releases publish the tag version as `latest`
 *
 * npm packages have no staging, so the stage environment is disabled
 * and tagged releases publish directly.
 */
const config = {
  appName: "test-app",
  customerName: "pan",
  releases: {
    when: "auto",
  },
  components: {
    lib: {
      dir: "lib",
      env: {
        stage: false,
      },
      build: {
        type: "node",
      },
      deploy: {
        type: "npmPackage",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Publish an npm package",
};
