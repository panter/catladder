import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
        lint: { timeout: "1h 30m" },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
      verify: {
        command: "yarn e2e",
        timeout: "10m",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Job timeout",
  description:
    "Sets a maximum run time on the verify job (10m) and the lint job (1h 30m). GitLab gets `timeout` as given, GitHub gets `timeout-minutes` in whole minutes.",
};
