import type {
  ComponentConfig,
  Config,
  DeployConfigCloudRunCloudSql,
} from "../src";

// both dbs currently need to run on the same instance
const CLOUD_SQL_BASE: DeployConfigCloudRunCloudSql = {
  type: "unmanaged",
  instanceConnectionName: "projectId:region:instancename",
  dbUser: "my-user",
};

const DbComponent = (name: string): ComponentConfig => ({
  dir: "packages/" + name,
  build: {
    type: "node",
  },
  deploy: {
    type: "google-cloudrun",
    projectId: "google-project-id",
    region: "europe-west6",
    // the default "embedded" connection string mode embeds the final values
    // into the db-url, so referencing DATABASE_URL from another component
    // (like DATABASE_URL_2 below) just works
    cloudSql: CLOUD_SQL_BASE,
    service: false,
    jobs: {
      migrate: {
        command: "yarn migrate",
      },
    },
    execute: {
      migrate: {
        type: "job",
        job: "migrate",
        when: "preDeploy",
      },
    },
  },
});
const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    // its good practise to have separated db components
    db1: DbComponent("db1"),
    db2: DbComponent("db2"),

    api: {
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
          // currently one db is the default, as it injects additional env vars
          ...CLOUD_SQL_BASE,
          dbBaseName: "db1",
        },
      },
      vars: {
        public: {
          // we reference the second db-url
          DATABASE_URL_2: "${db2:DATABASE_URL}",
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: With SQL Reuse DB",
};
