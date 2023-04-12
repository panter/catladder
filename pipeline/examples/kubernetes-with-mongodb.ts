import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";
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
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
