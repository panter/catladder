import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    gitlab: true,
    github: true,
  },
  reviewApps: {
    // only MRs/PRs carrying the `catladder:review-app` label deploy
    deploy: "optIn",
    // drafts run tests, lint and audit only
    drafts: "checksOnly",
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
        cloudSql: {
          type: "unmanaged",
          instanceConnectionName: "asdf:europe-west6:db",
          dbUser: "api",
          deleteDatabaseOnStop: true,
        },
      },
      verify: {
        command: "yarn e2e",
        waitFor: ["web"],
      },
    },
    web: {
      dir: "web",
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
  title: "Review apps: opt-in by label",
  description:
    "Review apps only deploy for merge requests / pull requests carrying the `catladder:review-app` label, and never for drafts. Tests, lint and audit run on every MR/PR; the docker → deploy → verify chains of all components wait for one switch per MR/PR (gitlab: the `🚀 deploy review` job, github: the `▶️ catladder deploy review` workflow). On github, removing the label stops the review apps.",
};
