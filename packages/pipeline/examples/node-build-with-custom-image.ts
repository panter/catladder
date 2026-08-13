import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
        jobImage: "my-custom-image",
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
  title: "Node: Build with Custom Image",
};
