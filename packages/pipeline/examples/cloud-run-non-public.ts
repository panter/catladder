import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
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
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Non Public",
};
