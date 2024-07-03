import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  runnerVariables: {
    GIT_SUBMODULE_STRATEGY: "recursive",
  },
  components: {
    app: {
      dir: "app",

      build: {
        type: "node",
      },

      deploy: {
        type: "google-cloudrun",
        projectId: "my-project-id",
        region: "europe-west6",
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
