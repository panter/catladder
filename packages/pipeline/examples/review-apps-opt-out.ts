import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    gitlab: true,
    github: true,
  },
  reviewApps: {
    // every MR/PR deploys, unless it carries the `catladder:no-review-app` label
    deploy: "optOut",
    // draft MRs/PRs run no pipeline at all
    drafts: "none",
  },
  components: {
    app: {
      dir: "app",
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
  title: "Review apps: opt-out by label",
  description:
    "Every merge request / pull request deploys its review app unless it carries the `catladder:no-review-app` label. Draft MRs/PRs run no pipeline at all.",
};
