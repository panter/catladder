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

export default config;
