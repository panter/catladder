import type { Config } from "@catladder/cli";

/**
 * E2E fixture: post-deploy verify (!414) × github manual gate (!413).
 *
 * verify applies to every env — so the prod verify job must follow the
 * manual prod deploy into the github manual-tasks workflow, while the
 * tag pipeline keeps stage deploy + verify automatic.
 */
const config: Config = {
  customerName: "pan",
  appName: "release-sandbox",
  pipelines: {
    gitlab: true,
    github: {
      gitRemote: "github",
    },
  },
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
        type: "custom",
        script: ['echo "sandbox no-op deploy for $CATLADDER_ENV"'],
        // every env gets a stop task: review stops run automatically on
        // PR close, the others are manual (gitlab job / github dispatch)
        stopScript: ['echo "sandbox no-op stop for $CATLADDER_ENV"'],
      },
      verify: {
        command: 'echo "verifying $CATLADDER_ENV — deploy is live"',
      },
    },
  },
};

export default config;
