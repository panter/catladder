import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";

const config: Config<{ CustomEnvs: "asdf" | "bla" }> = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: false,
      env: {
        local: {
          port: 4000,
        },
        asdf: {
          type: "dev",
        },
        bla: {
          type: "dev",
        },
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
