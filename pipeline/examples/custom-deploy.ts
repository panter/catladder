import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
      },
      deploy: {
        type: "custom",
        requiresDocker: true,
        jobVars: {
          secret: ["DEPLOY_API_KEY"],
        },
        script: ["echo 'would deploy'"],
        stopScript: ["echo 'would stop'"],
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
