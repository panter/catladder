import type { Config, DeployConfig } from "../src";

const DEPLOY_CONFIG: DeployConfig = {
  type: "google-cloudrun",
  projectId: "google-project-id",
  region: "europe-west6",
};

const config = {
  appName: "test-app",
  customerName: "pan",
  builds: {
    myWorkspace: {
      type: "node",
      // tests the whole workspace build, blocks the deploys of api and www
      postBuildTests: {
        e2e: {
          command: "yarn e2e",
          services: [
            {
              name: "postgres:17",
              alias: "postgres",
              variables: { POSTGRES_PASSWORD: "postgres" },
            },
          ],
          vars: {
            DATABASE_URL: "postgres://postgres:postgres@postgres:5432/postgres",
          },
        },
      },
    },
  },
  components: {
    api: {
      dir: "services/api",
      build: {
        from: "myWorkspace",
      },
      deploy: DEPLOY_CONFIG,
    },
    www: {
      dir: "services/www",
      build: {
        from: "myWorkspace",
        // tests only www, blocks only the deploy of www
        postBuildTests: {
          lighthouse: {
            command: "yarn lighthouse",
          },
        },
      },
      deploy: DEPLOY_CONFIG,
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Workspace build with post-build tests",
  description:
    "A post-build e2e test on the workspace build blocks the deploys of all its components, a post-build test on a component built in the workspace blocks only that component's deploy.",
};
