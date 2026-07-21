/**
 * changesets release method (feat/configurable-release-method).
 *
 * The pending .changeset (shipped via files/) makes the release job cut
 * a MINOR bump from the last v* tag, commit the changelog, push the tag
 * — and on github also dispatch the taggedRelease workflow (default
 * GITHUB_TOKEN tags don't trigger `on: push: tags`).
 */
export default {
  github: {
    static: [
      {
        file: ".github/workflows/catladder-main.yml",
        contains: ["catladder/changesets:"],
        notContains: ["catladder/semantic-release:"],
      },
    ],
    mainRun: {
      jobs: {
        "www 🚀 Deploy | dev": "success",
        "www 🔍 verify | dev": "success",
        "create release": "success",
      },
    },
    tagRun: {
      jobs: {
        "www 🔨 app | stage": "success",
        "www 🚀 Deploy | stage": "success",
        "www 🔍 verify | stage": "success",
        "www 🚀 Deploy | prod": "absent",
      },
    },
  },
  gitlab: {
    static: [
      {
        file: ".catladder-generated/gitlab/global-jobs.yaml",
        contains: ["job image changesets", "changesetsRelease"],
      },
    ],
    mainPipeline: {
      jobs: {
        "www 🚀 Deploy | dev": "success",
        "www 🔍 verify | dev": "success",
        "create release": "success",
      },
    },
    tagPipeline: {
      jobs: {
        "www 🚀 Deploy | stage": "success",
        "www 🔍 verify | stage": "success",
        "www 🚀 Deploy | prod": "manual",
      },
    },
  },
};
