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
        projectId: "google-project-id",
        region: "europe-west6",

        service: {
          executionEnvironment: "gen2",
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "Cloud Run: Service Gen2",
};
