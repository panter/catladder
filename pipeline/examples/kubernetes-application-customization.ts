import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
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
            autoscale: {
              minReplicas: 2,
              maxReplicas: 5,
              metrics: [
                {
                  type: "Resource",
                  resource: {
                    name: "cpu",

                    target: {
                      type: "Utilization",
                      averageUtilization: 0.5,
                    },
                  },
                },
              ],
            },
            resources: {
              limits: {
                cpu: "1",
                memory: "2048Mi",
              },
            },
          },
        },
      },
    },
  },
};

export default config;
