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
    },
  },
  hooks: {
    transformFileBeforeWrite({ filename, content }) {
      if (filename === ".gitlab-ci.yml") {
        // FIXME: currently not covered by the snapshot test
        return "# modified!\n\n" + content;
      }
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Custom: Modify Generated Files",
};
