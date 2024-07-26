import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    app1: {
      dir: "app1",
      build: {
        type: "node",
      },
      vars: {
        public: {
          foo: "foo-value",
          multiline: `app1 line1
app1 line2
app1 line3  

the url of self: "\${ROOT_URL}"


app1 single quote: '
app1 doouble quote: "
`,
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
    app2: {
      dir: "app2",
      build: {
        type: "node",
      },
      vars: {
        public: {
          foo: "foo-value",
          multiline: `app2 yeah
app2 yeah2
app2 yeah3  

app2 single quote: '
app2 doouble quote: "

the url of self: "\${ROOT_URL}"
the url of app1: "\${app1:ROOT_URL}"

value from app1:
-------
\${multiline_from_app1}
--------
`,
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
    kube: {
      dir: "kube",
      build: {
        type: "node",
      },
      vars: {
        public: {
          multiline_from_app1: "${app1:multiline}",
          multiline: `kube yeah
kube yeah2
kube yeah3  

kube single quote: '
kube doouble quote: "

the url of self: "\${ROOT_URL}"
the url of app1: "\${app1:ROOT_URL}"

value from app1:
-------
\${multiline_from_app1}
--------
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

export const information = {
  title: "Multiline Environment Variables",
};
