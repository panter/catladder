import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
        jobImage: "foo",
        docker: {
          type: "custom",
          dockerfileContent: [
            "FROM node:22",
            "USER node",
            "$DOCKER_COPY_WORKSPACE_FILES",
            "WORKDIR /app/$APP_DIR",
            "$DOCKER_COPY_AND_INSTALL_APP",
          ],
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Custom Dockerfile",
};
