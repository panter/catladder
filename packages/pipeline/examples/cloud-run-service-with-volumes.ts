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

        service: {
          volumes: {
            myMount: {
              type: "cloud-storage",
              bucket: "my-bucket",
              mountPath: "/mnt/my-mount",
            },

            myOtherMount: {
              type: "cloud-storage",
              bucket: "some-other-bucket",
              mountPath: "/mnt/my-second-mount",
              readonly: true,
            },
          },
        },

        jobs: {
          migrate: {
            command: "migrate",

            volumes: {
              myMount: {
                type: "cloud-storage",
                bucket: "my-bucket",
                mountPath: "/mnt/my-mount",
              },
            },
          },
        },

        execute: {
          migrate: {
            type: "job",
            job: "migrate",
            when: "postDeploy",
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Service with Volumes",
};
