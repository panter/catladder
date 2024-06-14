import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "app",
      build: {
        type: "node",
        startCommand: "",
        docker: {
          type: "nginx",
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
  },
};

export default config;

export const information = {
  title: "Cloud Run: With Nginx",
};
