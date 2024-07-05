import type { Config, DeployConfigCloudRunCloudSql } from "../src";

const CLOUD_SQL: DeployConfigCloudRunCloudSql = {
  type: "unmanaged",
  instanceConnectionName: "projectId:region:instancename",
  dbUser: "my-user",
};
const config: Config = {
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
        projectId: "google-project-id",
        region: "europe-west6",
        cloudSql: CLOUD_SQL,
      },
    },
    worker: {
      dir: "api",
      build: {
        type: "node",
        buildCommand: "yarn build:worker",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        cloudSql: {
          ...CLOUD_SQL,
          // override the db base name to the other component's name
          // if ommited, this defaults to the component's name
          dbBaseName: "api",
        },
      },
      vars: {
        public: {
          // need to reference the password
          DB_PASSWORD: "${api:DB_PASSWORD}",
        },
      },
    },
  },
};

export default config;
