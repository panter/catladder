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
      },
      env: {
        review: {
          deploy: {
            jobs: {
              // in this example we only declare the job on the review environment.
              ["drop-db"]: {
                command: [
                  "/bin/sh",
                  "-c", // in cloud run, you can't use env-vars in commands, so we have to do this trick
                  "mongosh \\$MONGO_URL --eval 'db.dropDatabase()'",
                ],
                image: "rtsp/mongosh:latest",
              },
            },
            execute: {
              ["drop-db"]: {
                type: "job",
                job: "drop-db",
                when: "postStop",
              },
            },
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Post Stop Job",
};
