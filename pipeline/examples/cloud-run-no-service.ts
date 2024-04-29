import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "app",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
        service: false,
        jobs: {
          "alarm-clock": {
            command: "./wake-up-call",
            when: "schedule",
            schedule: "0 7 0 0 1-5",
          },
        },
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
