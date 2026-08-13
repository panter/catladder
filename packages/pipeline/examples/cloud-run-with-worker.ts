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
        // worker pools are like services, but they don't have a load balanced endpoint and don't support autoscaling.
        // But they are 40% cheaper than services.
        workerPools: {
          // its usually better to create another catladder component for the worker
          // but in some legacy cases it might be easier to add service or worker pool
          // notice that you can't use different secrets on the worker, it will receive the same env vars as the normal service
          // you can specify extra vars though
          worker: {
            command: "yarn start:worker",
          },
        },
      },
      env: {
        review: {
          deploy: {
            workerPools: {
              worker: null, // disable the worker service on review
            },
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: With Worker",
};
