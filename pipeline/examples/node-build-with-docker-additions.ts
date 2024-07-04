import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
        docker: {
          additionsBegin: ["RUN apk add --no-cache openssl1.1-compat-dev"],
          additionsEnd: ["RUN yarn rebuild"],
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
  },
};

export default config;

export const information = {
  title: "Node: Build with Docker Additions",
};
