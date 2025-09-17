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
  components: {}, // currently we use custom gitlab
  hooks: {
    transformFileBeforeWrite: async ({
      filename,
      content,
      path,
      extension,
    }) => {
      if (filename === ".gitlab-ci.yml") {
        // inject the original gitlab ci file
        const custom = await readFile(".gitlab-ci-yaml-custom.yaml", "utf-8");
        return content + "\n\n" + custom;
      }
    },
  },
};

export default config;
