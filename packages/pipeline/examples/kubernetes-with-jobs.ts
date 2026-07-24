import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
      dotEnv: false,
      build: {
        type: "node",
      },
      deploy: {
        type: "kubernetes",
        cluster: {
          name: "some-cluster-name",
          region: "europe-west6",
          projectId: "some-project-id",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
        values: {
          jobs: {
            migration: {
              command: "yarn migrate",
            },
          },
          cronjobs: {
            ["send-emails"]: {
              command: "yarn send emails",
              schedule: "0 * * * *",
            },
          },
        },
      },
      env: {
        review: {
          deploy: {
            values: {
              cronjobs: {
                ["send-emails"]: false,
              },
            },
          },
        },
      },
    },
    www: {
      dir: "www",
      build: {
        type: "node",
      },
      deploy: {
        type: "kubernetes",
        cluster: {
          name: "some-cluster-name",
          region: "europe-west6",
          projectId: "some-project-id",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "K8s: With Jobs",
};
