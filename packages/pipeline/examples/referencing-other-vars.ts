import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    app1: {
      dir: "app1",
      build: {
        type: "node",
      },
      vars: {
        secret: ["SECRET1"],
        public: {
          foo: "foo-value",
          bar: "bar-value",
          foo3: "from app3: ${app3:foo3}",
          circle:
            'this is from app3 that has reference to app1: "${app3:transitive}"', // not officially recommended, but may work in some cases
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
        secret: ["SECRET2"],
        public: {
          foo2: "foo-value-2",
          referencingSecret: "secret1: ${app1:SECRET1}, secret2: ${SECRET2}",
          foo1: "this is from app1: ${app1:foo}",
          selfReference: "this is from self: ${foo2}",
          selfReference2: "this is from self: ${foo1}",
          app1Api: "${app1:ROOT_URL}/graphql",
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
    app3: {
      dir: "kube",
      build: {
        type: "node",
      },
      vars: {
        public: {
          foo3: "foo-value-3",
          foo2: "this is from app2: ${app2:foo2}",
          transitive: "this is from app2: ${app2:foo1}",
          transitiveWithSecret: "this is from app2: ${app2:referencingSecret}",
          someJson:
            '[{"name": "app1", "url": "${app1:ROOT_URL}"}, {"name": "app2", "url": "${app2:ROOT_URL}"}, {"name": "app3", "url": "${ROOT_URL}"}]',
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
} satisfies Config;

export default config;

export const information = {
  title: "Multiline Environment Variables",
};
