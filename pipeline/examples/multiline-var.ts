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
      vars: {
        public: {
          foo: "foo-value",
          multiline: `line1
line2
line3  

single quote: '
doouble quote: "
`,
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
    api2: {
      dir: "api",
      build: {
        type: "node",
      },
      vars: {
        public: {
          multiline_from_api: "${api:multiline}",
          multiline2: `yeah
yeah2
yeah3  

single quote: '
doouble quote: "
`,
        },
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
};

export default config;
