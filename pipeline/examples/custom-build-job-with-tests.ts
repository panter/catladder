import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";

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

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
