import type { Config, DeployConfig } from "../src";

const DEPLOY_CONFIG: DeployConfig = {
  type: "google-cloudrun",
  projectId: "google-project-id",
  region: "europe-west6",
};
const config: Config = {
  appName: "test-app",
  customerName: "pan",
  builds: {
    myWorkspace: {
      type: "node",
      cache: {
        paths: [".turbo"],
      },
    },
  },
  components: {
    api: {
      dir: "api",
      build: {
        from: "myWorkspace",
        cache: {
          paths: [".component-custom-cache"],
        },
      },
      deploy: DEPLOY_CONFIG,
    },
    www: {
      dir: "www",
      build: {
        from: "myWorkspace",
        cache: {
          paths: [".next/cache"],
        },
      },
      deploy: DEPLOY_CONFIG,
      vars: {
        public: {
          API_URL: "${api:ROOT_URL}/graphql",
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "Workspace API and WWW",
};
