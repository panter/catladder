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

          public: {
            // if your deploy job requires more memory and/or cpu, you can increase them with those variables:
            KUBERNETES_CPU_REQUEST: "1",
            KUBERNETES_MEMORY_REQUEST: "1024Mi",
            KUBERNETES_MEMORY_LIMIT: "2048Mi",
          },
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
