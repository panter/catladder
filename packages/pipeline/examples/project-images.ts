import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  images: {
    "java-build": {
      dir: "packages/pipeline/examples/__fixtures__/project-image",
      buildArgs: {
        JAVA_VERSION: "21",
      },
    },
  },
  components: {
    api: {
      dir: "api",
      build: {
        type: "custom",
        jobImage: { image: "java-build" },
        docker: {
          type: "custom",
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "test-project",
        region: "europe-west1",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Project-declared Job Images",
};
