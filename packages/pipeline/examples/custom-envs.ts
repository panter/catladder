import type { Config } from "../src";

const config = {
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
} satisfies Config<{ CustomEnvs: "asdf" | "bla" }>;

export default config;

export const information = {
  title: "Custom: Envs",
};
