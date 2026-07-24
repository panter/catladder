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
        projectId: "google-project-id",
        region: "europe-west6",
        workerPools: {
          worker: {
            instances: 1, // is the default value
            command: "yarn start:worker",
            cpu: 1,
            memory: "512Mi",
          },
        },
      },
      env: {
        review: {
          deploy: {
            workerPools: {
              worker: null, // disable the worker pool on review
            },
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Worker Pool",
};
