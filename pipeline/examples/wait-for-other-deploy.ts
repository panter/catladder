import type { Config } from "../src";

const config: Config<{ CustomEnvs: "asdf" | "bla" }> = {
  appName: "test-app",
  customerName: "pan",
  components: {
    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "custom",
        requiresDocker: false,
        script: ["yarn deploy"],
      },
    },
    www: {
      dir: "www",
      build: {
        type: "node",
      },
      deploy: {
        waitFor: ["api"],
        type: "custom",
        requiresDocker: false,
        script: ["yarn deploy"],
      },
    },
  },
};

export default config;

export const information = {
  title: "Wait for other deployment",
};
