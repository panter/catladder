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
          vpcConnector: "my-first-vpc-connector",
          vpcEgress: "all-traffic",
        },
        jobs: {
          myjob: {
            command: "echo hello",
            vpcConnector: "my-first-vpc-connector",
            vpcEgress: "all-traffic",
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Service with custom vpc settings",
};
