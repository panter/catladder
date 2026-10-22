import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    gitlab: true,
    github: true,
  },
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "europe-west6",
      },
    },
    storybook: {
      dir: "storybook",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "europe-west6",
      },
      env: {
        review: {
          // only this component's review app deploys on request
          deploy: { when: "manual" },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Review apps: one component on request",
  description:
    "Without `reviewApps`, a single component's review deploy can still be manual (`deploy.when`). Gitlab shows it as a manual job in the MR pipeline; github moves that component's docker → deploy chain into the `▶️ catladder deploy review` workflow, dispatched with the PR number, while the review workflow keeps running all tests.",
};
