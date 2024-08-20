import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "app",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
        service: false,
        jobs: {
          "alarm-clock": {
            command: "./wake-up-call",
          },
        },
        execute: {
          "alarm-clock-scheduler": {
            type: "job",
            job: "alarm-clock",
            when: "schedule",
            schedule: "0 7 0 0 1-5",
          },
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "Cloud Run: No Service",
};
