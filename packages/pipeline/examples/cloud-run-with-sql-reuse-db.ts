import type { Config, DeployConfigCloudRunCloudSql } from "../src";

const CLOUD_SQL: DeployConfigCloudRunCloudSql = {
  type: "unmanaged",
  instanceConnectionName: "projectId:region:instancename",
  dbUser: "my-user",
};
const config = {
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
          // reference the owning component's password. This override also
          // flows into the generated DATABASE_URL / DATABASE_JDBC_URL
          DB_PASSWORD: "${api:DB_PASSWORD}",
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: With SQL Reuse DB",
};
