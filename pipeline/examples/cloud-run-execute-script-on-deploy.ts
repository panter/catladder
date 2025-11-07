import type { Config } from "../src";

const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    app: {
      dir: "app",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "google-project-id",
        region: "europe-west6",
        execute: {
          "pre-deploy-script": {
            type: "script",
            script: ["echo 'deploying'"],
            when: "preDeploy",
          },
          "post-deploy-script": {
            type: "script",
            script: ["echo 'deployed'"],
            when: "postDeploy",
          },
        },
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Cloud Run: Execute script on deploy",
};
