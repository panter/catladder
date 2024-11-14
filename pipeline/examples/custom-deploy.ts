import type { Config } from "../src";

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
        runnerVariables: {
          // if your deploy job requires more memory and/or cpu, you can increase them with those variables:
          KUBERNETES_CPU_REQUEST: "1",
          KUBERNETES_MEMORY_REQUEST: "1024Mi",
          KUBERNETES_MEMORY_LIMIT: "2048Mi",
        },
        script: ["echo 'would deploy'"],
      },
      env: {
        review: {
          deploy: {
            script: ['ROOT_URL="$(my deploy command)"'], // be careful as arrays are merged currently
            stopScript: ["echo 'would stop'"],
          },
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "Custom: Deploy",
};
