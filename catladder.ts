import { readFile } from "fs/promises";
import type { Config } from "./pipeline/src";

// this project did not use catladder itself to create its pipeline
// however we now start to use some of its features
// the original gitlab ci file is injected here as well (see below)
const config: Config = {
  appName: "catladder",
  customerName: "pan",
  agents: {
    claude: {
      type: "claude",
    },
  },
  releases: {
    when: "auto",
  },
  // dogfood the agent skills, but only the claude-code copy — the
  // .agents/ copy would just duplicate it in this repo's diffs
  agentSkills: { targets: ["claude-code"] },
  components: {}, // currently we use custom gitlab
  hooks: {
    transformYamlBeforeWrite: async ({ filename, data }) => {
      if (filename === ".gitlab-ci.yml") {
        // inject the original gitlab ci file
        return {
          ...data,
          include: [
            {
              local: ".gitlab-ci-yaml-custom.yaml",
              rules: [
                // do not include when its a agent trigger
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
};

export default config;
