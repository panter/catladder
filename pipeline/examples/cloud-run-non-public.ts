import type { Config } from "../src";

const config: Config = {
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
};

export default config;

export const information = {
  title: "Cloud Run: Non Public",
};
