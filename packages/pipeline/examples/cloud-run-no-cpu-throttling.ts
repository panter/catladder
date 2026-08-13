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

        service: {
          minInstances: 1,
          // careful, this is expensive!
          // this will always allocate the cpu
          // use this if you have background tasks.

          // consider using cloud task instead of this
          noCpuThrottling: true,
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: No CPU Throttling",
};
