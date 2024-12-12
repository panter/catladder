import type { Config } from "../src";

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
          migrate: {
            command: "yarn migrate",
          },
          ["send-reminders"]: {
            command: "yarn job:send-reminders",
            args: ["--verbose=false"],
          },
        },
        execute: {
          migrate: {
            type: "job",
            job: "migrate",
            when: "preDeploy",
            waitForCompletion: true,
            args: ["--verbose=true", "--create-db"],
          },
          ["send-reminders-admins"]: {
            type: "job",
            when: "schedule",
            job: "send-reminders",
            args: ["--only-admins", "--verbose=true"],
            schedule: "0 * * * *",
          },
          ["send-reminders"]: {
            type: "job",
            when: "schedule",
            job: "send-reminders",
            schedule: "0 * * * *",
          },
          ["call-http-endpoint"]: {
            type: "http",
            url: "${ROOT_URL}/myEndpoint",
            when: "schedule",
            schedule: "0 * * * *",
            method: "GET",
          },
        },
      },
      env: {
        review: {
          deploy: {
            execute: {
              "send-reminders": null, // disable on this env
            },
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: With SQL",
};
