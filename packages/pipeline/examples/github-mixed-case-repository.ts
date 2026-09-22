import type { Config } from "../src";

/**
 * ghcr image paths must be lowercase, but `${{ github.repository }}`
 * interpolates github's display casing — so a project whose owner or
 * repository name contains an uppercase character (very common for org
 * logins) gets a lowercased literal baked into the generated workflows
 * instead of the expression.
 *
 * `pipelines.github.repository` pins the repository explicitly here;
 * in a real project catladder resolves it from the git remote.
 */
const config = {
  appName: "test-app",
  customerName: "pan",
  pipelines: {
    github: {
      repository: "FiulAG/Nautilus",
    },
  },
  images: {
    "db-tools": {
      dockerfile: ["FROM alpine:3.21", "RUN apk add --no-cache curl"],
    },
  },
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
        test: {
          command: "yarn test:db",
          jobImage: { image: "db-tools" },
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
  title: "Github: Mixed-case repository name",
};
