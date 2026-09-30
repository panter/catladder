import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    app: {
      dir: ".",
      dotEnv: false,
      envDTs: false,
      build: {
        type: "rails",
        test: false,
        lint: false,
        audit: false,
        cnbBuilder: {
          buildVars: { SECRET_KEY_BASE: "dummy-value" },
        },
        // stage and prod copy the image built on the main branch (dev)
        // instead of building it again
        reuseMainBranchImage: true,
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
  title: "K8s: Rails reusing the main branch image in releases",
};
