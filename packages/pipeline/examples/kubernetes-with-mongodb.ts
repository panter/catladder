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
          application: {
            command: "node main.js",
          },
          mongodb: {
            enabled: true,
            architecture: "replicaset",
            persistence: {
              storageClass: "premium-rwo",
            },
            tolerations: [
              {
                key: "mongodb",
                operator: "Equal",
                value: "true",
                effect: "NoSchedule",
              },
            ],
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "K8s: With MongoDB",
};
