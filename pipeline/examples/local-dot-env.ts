import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dotEnv: "local", // creates .env file only locally, not during build
      envDTs: true, // creates type files based on env vars, so that process.env is typed
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
      },
    },
  },
};

export default config;
