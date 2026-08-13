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
    // example include a file
    transformYamlBeforeWrite: async ({ filename, data }) => {
      if (filename === ".gitlab-ci.yml") {
        // inject the original gitlab ci file
        return {
          ...data,
          include: [
            {
              local: ".gitlab-ci-yaml-custom.yaml",
              rules: [
                // optional conditions. here: do not include when its a agent trigger
                { if: `$CI_PIPELINE_SOURCE == "trigger"`, when: "never" },
                { when: "always" },
              ],
            },
            ...data.include,
          ],
        };
      }
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Custom: Modify Generated Files",
};
