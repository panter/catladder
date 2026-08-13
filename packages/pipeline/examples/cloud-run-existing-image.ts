import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "app",
      build: false,
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        service: {
          image: "gcr.io/google-project-id/my-image:latest",
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: With existing image",
};
