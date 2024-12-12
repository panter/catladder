import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
      env: {
        review: {
          deploy: {
            script: ['ROOT_URL="$(my deploy command)"'],
          },
        },
      },
      customJobs: (context) => [
        {
          name: `e2e`,
          stage: "verify",
          needsStages: [{ stage: "deploy" }],
          envMode: "jobPerEnv",
          cache: {
            key: "cypress",
            policy: "pull-push",
            paths: [".yarn/cache", "node_modules/", "cache/cypress"],
          },
          image: "cypress/browsers",
          script: [
            "yarn install --frozen-lockfile",
            `echo "custom job for env '${context.environment.envType}'"`, // a test to test the
            `CYPRESS_BASE_URL=$CI_ENVIRONMENT_URL yarn cypress:run:ci`,
          ],
          environment: {
            action: "access",
          },
          variables: {
            CYPRESS_CACHE_FOLDER: "$CI_PROJECT_DIR/cache/cypress",
          },
          artifacts: {
            expire_in: "1 week",
            when: "always",
            reports: {
              junit: [`cypress/results/report-*.xml`],
            },
            paths: [`cypress/results`, `cypress/screenshots`, `cypress/videos`],
          },
        },
      ],
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Job",
};
