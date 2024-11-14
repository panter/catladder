import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    ["my-app"]: {
      dir: "app",
      build: {
        type: "node",
      },
      vars: {
        secret: ["MY_SECRET"],
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "my-project-id",
        region: "europe-west6",
      },
      env: {
        local: {
          vars: {
            secret: ["MY_LOCAL_SECRET"],
          },
        },
        review: {
          vars: {
            secret: ["MY_REVIEW_SECRET"],
          },
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "Multiline Environment Variables",
};
