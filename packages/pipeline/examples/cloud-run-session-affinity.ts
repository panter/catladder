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
          sessionAffinity: true,
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: with session affinity",
};
