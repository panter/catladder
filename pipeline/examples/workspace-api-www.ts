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
    },
  },
  components: {
    api: {
      dotEnv: true,
      dir: "api",
      build: {
        from: "myWorkspace",
      },
      deploy: DEPLOY_CONFIG,
    },
    www: {
      dotEnv: true,
      dir: "www",
      build: {
        from: "myWorkspace",
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
