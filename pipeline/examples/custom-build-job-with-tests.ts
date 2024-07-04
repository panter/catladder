import type { Config } from "../src";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "www",
      build: {
        type: "custom",
        jobImage: "foo",
        jobServices: [
          {
            name: "job-service-1",
            command: ["--some-command=some-value"],
          },
        ],
        docker: {
          type: "nginx",
        },
        lint: {
          command: "lint",
          jobImage: "lint-image",
          artifactsReports: {
            junit: ["dist/lint.xml"],
          },
        },
        test: {
          command: "test",
          jobImage: "test-image",
          artifactsReports: {
            junit: ["dist/TEST-*.xml", "dist/junit-*.xml"],
          },
        },
        audit: {
          command: "audit",
          jobImage: "audit-image",
          artifactsReports: {
            junit: ["dist/audit.xml"],
          },
        },
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
  },
};

export default config;

export const information = {
  title: "Cloud Run: Job with Tests",
};
