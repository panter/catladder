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
        },
        test: {
          command: "test",
          jobImage: "test-image",
        },
        audit: {
          command: "audit",
          jobImage: "audit-image",
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
