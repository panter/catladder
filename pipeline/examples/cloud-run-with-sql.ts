import type { Config } from "../src";

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
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        // optional, set min and max instances
        // defaults to 0-100
        service: {
          minInstances: 0,
          maxInstances: 5,
        },
        cloudSql: {
          type: "unmanaged",
          instanceConnectionName: "projectId:region:instancename",
          dbUser: "my-user",
        },
        jobs: {
          migration: {
            when: "postDeploy",
            command: "yarn migrate",
          },
          ["send-reminders"]: {
            when: "schedule",
            command: "yarn job:send-reminders",
            schedule: "0 * * * *",
            timeout: "15m",
          },
        },
      },
    },
    www: {
      dotEnv: true,
      dir: "www",
      build: {
        from: "myWorkspace",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
      },
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
  title: "Cloud Run: With SQL",
};
