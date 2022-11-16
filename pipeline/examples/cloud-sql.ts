import type { Config } from "../src";

const config: Config<{ CustomEnvs: "asdf" | "bla" }> = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "europe-west6",
        cloudSql: {
          type: "unmanaged",
          instanceConnectionName: "projectId:region:instancename",
        },
        jobs: {
          migration: {
            when: "postDeploy",
            command: "yarn migrate",
          },
        },
      },
      env: {
        local: {
          port: 4000,
        },
        asdf: {
          type: "dev",
        },
        bla: {
          type: "dev",
        },
      },
    },
  },
};

export default config;
