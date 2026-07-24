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
        region: "europe-west4", // verify in which regions GPUs are available, europe-west6 is not supported as of time of writing
        service: {
          gpu: 1,
          gpuType: "nvidia-l4",
          memory: "32Gi",
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: With GPU",
};
