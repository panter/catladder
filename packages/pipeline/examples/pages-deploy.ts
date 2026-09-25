import type { Config } from "../src";

/**
 * publishes a static site (docs, storybook, coverage report) on gitlab
 * pages. Review environments automatically publish under an `mr-<iid>`
 * path prefix, so every merge request gets its own site preview
 * (gitlab parallel deployments: Premium/Ultimate — on CE/Free disable
 * the review env, a review deploy would overwrite the main site).
 */
const config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    docs: {
      dir: "docs",
      // pages only exist on the main branch (+ MR previews)
      env: { stage: false, prod: false },
      build: false,
      deploy: {
        type: "pages",
        requiresInstall: true,
        script: ["yarn workspace docs build"],
        // publishDir: "public",  // default
      },
    },
  },
} satisfies Config;

export default config;

export const information = {
  title: "Publish a site on gitlab pages",
};
