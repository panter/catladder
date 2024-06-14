import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "app",
      build: {
        type: "node",
        buildCommand: "yarn build-storybook --quiet -o ./dist",
        startCommand: "",
        docker: {
          type: "nginx",
        },
        test: false,
        lint: false,
        audit: false,
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
  title: "Cloud Run: Storybook",
};
