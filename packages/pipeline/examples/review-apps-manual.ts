import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    gitlab: true,
    github: true,
  },
  reviewApps: {
    // review apps only deploy on request
    deploy: "manual",
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
    worker: {
      dir: "worker",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "europe-west6",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Review apps: deploy on request",
  description:
    "Review apps never deploy on their own. One switch per merge request / pull request deploys all components: play the `🚀 deploy review` job (gitlab) or dispatch `▶️ catladder deploy review` with the PR number (github). Docker images are only built when the switch is used.",
};
