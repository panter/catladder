import type { Config } from "../src";

const config = {
  appName: "agent-example-app",
  customerName: "pan",
  // Note: AI agents are experimental
  agents: {
    claude: {
      type: "claude",
    },
  },
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
  title: "Cloud Run: With AI Agents",
  description:
    "Example showing how to configure AI agents for automated code review and issue analysis",
};
