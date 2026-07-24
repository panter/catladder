import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    db: {
      dir: "db",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
        service: {
          allowUnauthenticated: false,
        },
      },
      verify: {
        command: "yarn e2e",
        waitFor: ["db"],
      },
      env: {
        prod: {
          verify: false,
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Post-deploy verify",
  description:
    "Runs an e2e suite in the verify stage after each deploy. The verify job waits for the db component's deploy, authenticates via application default credentials because the service is non-public, and is disabled for prod.",
};
