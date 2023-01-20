import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
        service: {
          allowUnauthenticated: false,
        },
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
