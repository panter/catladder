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
          cloudsql: {
            enabled: true,
            type: "unmanaged",
            instanceConnectionName: "myproject:europe-west6:instance-name",
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "K8s: With Cloud SQL",
};
