import type { Config, DeployConfig } from "../src";

const DEPLOY_CONFIG: DeployConfig = {
  type: "google-cloudrun",
  projectId: "google-project-id",
  region: "europe-west6",
};

/**
 * a workspace build whose components are real workspace members (the
 * test setup registers `services/api` and `services/www` as yarn
 * workspaces), with a verify (e2e) job on www — this snapshots the
 * cache keys the component-scoped jobs (verify, docker) use relative
 * to what the workspace build jobs save.
 */
const config = {
  appName: "test-app",
  customerName: "pan",
  builds: {
    myWorkspace: {
      type: "node",
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
      },
      deploy: DEPLOY_CONFIG,
      verify: {
        command: "yarn e2e",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Workspace build with verify job",
};
