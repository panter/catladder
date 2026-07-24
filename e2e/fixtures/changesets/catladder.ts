import type { Config } from "@catladder/cli";

/**
 * E2E fixture: the changesets release method.
 *
 * Identical to verify-manual-gate except `releases.method` — the
 * release job must use the changesets image and consume the pending
 * `.changeset/*.md` (shipped via files/) into a version bump + tag.
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
    method: "changesets",
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
