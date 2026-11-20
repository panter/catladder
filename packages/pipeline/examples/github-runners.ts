import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",

  pipelines: {
    github: {
      // run the generated jobs on third-party runners instead of
      // github's hosted ubuntu-latest (needs the provider's GitHub App)
      runner: {
        // build, lint, docker, deploy, … of every component
        default: { provider: "celesto", size: "memory" },
        // the slow test job gets a bigger machine
        jobs: { test: { provider: "celesto", size: "large" } },
        // jobs that see prod secrets stay on github's own runners
        environments: { prod: "ubuntu-latest" },
        // catladder's housekeeping jobs (image check, ✅ checks,
        // release) default to the provider's small size
      },
    },
  },

  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "GitHub runners (third-party runner providers)",
};
