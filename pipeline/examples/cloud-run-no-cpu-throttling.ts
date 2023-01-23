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
        projectId: "google-project-id",
        region: "europe-west6",

        service: {
          minInstances: 1,
          // careful, this is expensive!
          // this will always allocate the cpu
          // use this if you have background tasks.

          // consider using cloud task instead of this
          noCpuThrottling: true,
        },
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
