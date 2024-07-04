import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  runnerVariables: {
    GIT_SUBMODULE_STRATEGY: "recursive",
  },
  components: {
    app: {
      dir: "app",

      build: {
        type: "node",
      },

      deploy: {
        type: "google-cloudrun",
        projectId: "my-project-id",
        region: "europe-west6",
      },
    },
  },
};

export default config;

export const information = {
  title: "Git Submodule",
};
