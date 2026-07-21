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
  jobImages: "repo",
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
      },
      verify: {
        command: 'echo "verifying $CATLADDER_ENV — deploy is live"',
      },
      env: {
        review: {
          deploy: {
            stopScript: ['echo "sandbox no-op review stop"'],
          },
        },
      },
    },
  },
};

export default config;
