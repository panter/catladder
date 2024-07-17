import type { Config } from "../src";

const config: Config = {
  customerName: "pan",
  appName: "my-app",
  components: {
    web: {
      dir: "app",
      dotEnv: false,
      build: { type: "meteor" },
      deploy: {
        type: "kubernetes",
        values: {
          mongodb: {
            enabled: true,
            architecture: "standalone",
          },
          application: {
            worker: { enabled: true },
          },
        },
        cluster: {
          name: "some-cluster-name",
          region: "europe-west6",
          projectId: "some-project-id",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
      },
      env: {
        prod: {
          host: "www.example.com",

          deploy: {
            values: {
              application: {
                redirects: [{ host: "example.com" }],
              },
              mongodb: {
                enabled: true,
                architecture: "replicaset",
                replicaCount: 2,
                persistence: {
                  storageClass: "premium-rwo", // SSD
                  size: "50Gi",
                },
                resources: {
                  limits: { memory: "8Gi" },
                  requests: { memory: "8Gi" },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "K8s: Meteor",
};
