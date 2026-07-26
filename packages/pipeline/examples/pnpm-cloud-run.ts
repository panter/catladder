import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  // usually autodetected (packageManager field / lockfile); set
  // explicitly here so the example is self-contained
  packageManager: "pnpm",
  components: {
    www: {
      dir: "www",
      build: {
        type: "node",
        cache: {
          paths: [".next/cache"],
        },
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
  title: "pnpm: Cloud Run",
};
