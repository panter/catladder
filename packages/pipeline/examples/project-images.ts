import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  images: {
    // a directory in the repository containing a Dockerfile
    "java-build": {
      dir: "packages/pipeline/examples/__fixtures__/project-image",
      buildArgs: {
        JAVA_VERSION: "21",
      },
    },
    // an inline Dockerfile — materialized into the generated files,
    // built with the repository root as context
    "db-tools": {
      dockerfile: [
        "FROM alpine:3.21",
        "RUN apk add --no-cache postgresql17-client",
      ],
    },
  },
  components: {
    api: {
      dir: "api",
      build: {
        type: "custom",
        jobImage: { image: "java-build" },
        test: {
          command: "yarn test:db",
          jobImage: { image: "db-tools" },
        },
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
