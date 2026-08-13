import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  releases: {
    when: "auto",
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
  title: "Automatic Releases on main branch",
};
