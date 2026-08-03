import type { Config } from "./packages/pipeline/src";

// catladder ships itself with catladder: the whole pipeline (build,
// test, npm publish, docs pages, releases) is generated from this file.
const config: Config = {
  appName: "catladder",
  customerName: "pan",
  // catladder lives on github.com/panter/catladder
  pipelines: {
    github: true,
  },
  releases: {
    when: "auto",
    // dogfood the changesets release method: merging a changeset to the
    // main branch releases; no pending changesets → no-op
    method: "changesets",
  },
  builds: {
    // one shared turbo build for the whole monorepo (docs builds in its
    // own pages deploy job, matching the previous hand-written setup)
    base: {
      type: "node",
      dir: ".",
      buildCommand: "yarn build",
      runnerVariables: {
        // always ncc-minify: canaries then ship the same artifact shape
        // as tagged releases (previously only tags were minified)
        SHOULD_MINIFY: "1",
      },
      test: {
        command: "yarn test",
        runnerVariables: {
          KUBERNETES_MEMORY_LIMIT: "8Gi",
          KUBERNETES_MEMORY_REQUEST: "6Gi",
        },
      },
    },
  },
  components: {
    cli: {
      dir: "apps/cli",
      // this repo does not use catladder-generated .env files
      dotEnv: false,
      envDTs: false,
      // npm has no staging — tagged releases publish latest directly
      env: { stage: false },
      build: {
        from: "base",
      },
      deploy: {
        type: "npmPackage",
      },
    },
    docs: {
      dir: "apps/docs",
      dotEnv: false,
      envDTs: false,
      // docs only exist as pages on the main branch (+ MR previews)
      env: {
        stage: false,
        prod: false,
        dev: {},
        // MR docs previews are gitlab-only (github pages serves one
        // site per repository), so they go away with the migration
        review: false,
      },
      build: false,
      deploy: {
        type: "pages",
        requiresYarnInstall: true,
        script: ["yarn workspace docs gen-md", "yarn workspace docs build"],
      },
    },
  },
};

export default config;
