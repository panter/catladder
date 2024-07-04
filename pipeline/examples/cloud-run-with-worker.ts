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
        additionalServices: {
          // its usually better to create another catladder component for the worker
          // but in some legacy cases it might be easier to add an extra service
          // notice that you can't use different secrets on the worker, it will receive the same env vars as the normal service
          // you can specify extra vars though
          worker: {
            noCpuThrottling: true,
            maxInstances: 1,
            minInstances: 1,
            command: "yarn start:worker",
          },
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "Cloud Run: With Worker",
};
