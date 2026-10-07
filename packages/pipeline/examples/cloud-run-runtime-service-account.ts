import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    web: {
      dir: "web",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        // services, jobs and worker pools run as a catladder-managed
        // service account (cl-r-...) instead of the default compute
        // account. `catladder project setup` creates it and binds
        // roles/cloudsql.client (implied by cloudSql) plus these roles
        runtimeServiceAccount: {
          roles: ["roles/aiplatform.user"],
          bucketRoles: {
            "my-media-bucket": ["roles/storage.objectUser"],
          },
        },
        cloudSql: {
          type: "unmanaged",
          instanceConnectionName: "projectId:region:instancename",
        },
        jobs: {
          migrate: {
            command: "yarn migrate",
          },
          // a single job can run as another (existing) account
          export: {
            command: "yarn export",
            runtimeServiceAccount:
              "exporter@google-project-id.iam.gserviceaccount.com",
          },
        },
        workerPools: {
          worker: {
            command: "yarn start:worker",
          },
        },
        execute: {
          migrate: {
            type: "job",
            job: "migrate",
            when: "preDeploy",
            waitForCompletion: true,
          },
        },
      },
    },
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        // an existing service account, managed outside catladder
        runtimeServiceAccount: "api@google-project-id.iam.gserviceaccount.com",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Runtime service account",
};
