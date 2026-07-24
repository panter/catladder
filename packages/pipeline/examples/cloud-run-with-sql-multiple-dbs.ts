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
    cloudSql: {
      ...CLOUD_SQL_BASE,
      /*
      there is a flaw in the current implementation, 
      that the db-url does not embed the env vars like DB_NAME, DB_USER, DB_PASSWORD, etc, 
      This leads to the problem that if you reference the DATABASE_URL from another component,
      it will not work properly, as it only contains var names instead of the actual values.
      Setting this to "embedded" will embed the actual values into the db-url, which solves this problem.
      */
      dbConnectionStringVariablesMode: "embedded",
    },
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
