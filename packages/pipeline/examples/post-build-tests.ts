import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    web: {
      dir: "apps/web",
      build: {
        type: "node",
        postBuildTests: {
          e2e: {
            command: "pnpm test:e2e",
            jobImage: "mcr.microsoft.com/playwright:v1.56.0-noble",
            services: [
              {
                name: "postgres:17",
                alias: "postgres",
                variables: { POSTGRES_PASSWORD: "postgres" },
              },
            ],
            vars: {
              DATABASE_URL:
                "postgres://postgres:postgres@postgres:5432/postgres",
              BASE_URL: "http://localhost:3000",
            },
            artifacts: {
              paths: ["apps/web/playwright-report", "apps/web/test-results"],
            },
            artifactsReports: { junit: ["test-results/junit.xml"] },
          },
          a11y: {
            command: "pnpm test:a11y",
            allowFailure: true,
          },
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
      env: {
        dev: {
          build: {
            postBuildTests: {
              a11y: false,
            },
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Post-build tests",
  description:
    "Runs an e2e suite with a postgres service and an a11y check in the post-build stage, against the build artifacts. The deploy waits for both; the a11y check is allowed to fail and disabled for dev. Reports are uploaded also when the tests fail.",
};
