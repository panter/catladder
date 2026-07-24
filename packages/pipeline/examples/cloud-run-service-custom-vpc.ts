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
          network: "my-network",
          subnet: "my-subnet",
          vpcEgress: "all-traffic",
        },
        jobs: {
          myjob: {
            command: "echo hello",
            network: "my-network",
            subnet: "my-subnet",
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
