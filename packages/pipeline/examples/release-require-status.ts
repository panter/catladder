import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: { github: true },
  releases: {
    when: "manual",
    method: "changesets",
    // release a commit only once its full e2e suite is green. The suite
    // runs in its own workflow (`🔬 e2e main`, maintained in the repo)
    // after the main workflow deployed dev, and reports the commit
    // status `e2e-main`
    requireStatus: { context: "e2e-main", workflow: "🔬 e2e main" },
  },
  components: {
    web: {
      dir: "web",
      build: { type: "node" },
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
  title: "Release gated on an external commit status",
  description:
    "A release runs only once the commit status `e2e-main` (an e2e suite in its own workflow after the dev deploy) is green for exactly the released commit.",
};
