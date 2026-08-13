/**
 * verify (!414) × manual gate (!413), both backends.
 *
 * github: prod deploy AND its dependent prod verify live only in the
 * manual-tasks workflow, gated on the www-deploy-prod dispatch choice;
 * the tag run deploys + verifies stage automatically. The tag run also
 * proves catci's dispatch-tagged-workflow (GITHUB_TOKEN tags don't
 * trigger `on: push: tags`).
 *
 * gitlab: inline manual gate — tag pipeline has prod deploy as a manual
 * job; stage deploy + verify run automatically.
 */
export default {
  github: {
    static: [
      {
        file: ".github/workflows/catladder-release.yml",
        contains: ["www-verify-stage"],
        notContains: ["www-deploy-prod", "www-verify-prod"],
      },
      {
        file: ".github/workflows/catladder-main.yml",
        contains: ["www-verify-dev"],
        notContains: ["www-deploy-prod"],
      },
      {
        file: ".github/workflows/catladder-manual.yml",
        contains: [
          "- www-deploy-prod",
          "www-verify-prod",
          "inputs.job == 'www-deploy-prod'",
        ],
      },
    ],
    mainRun: {
      jobs: {
        "www 🧪 test | dev": "success",
        "www 👮 lint | dev": "success",
        "www 🔨 app | dev": "success",
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
        "www 🔍 verify | prod": "absent",
      },
    },
    dispatches: [
      {
        workflow: "catladder-manual.yml",
        input: { job: "www-deploy-prod" },
        jobs: {
          "www 🔨 app | prod": "success",
          "www 🚀 Deploy | prod": "success",
          "www 🔍 verify | prod": "success",
          "create release": "skipped",
        },
      },
    ],
  },
  gitlab: {
    mainPipeline: {
      jobs: {
        "www 🧪 test | dev": "success",
        "www 👮 lint | dev": "success",
        "www 🔨 app | dev": "success",
        "www 🚀 Deploy | dev": "success",
        "www 🔍 verify | dev": "success",
        "create release": "success",
      },
    },
    tagPipeline: {
      jobs: {
        "www 🔨 app | stage": "success",
        "www 🚀 Deploy | stage": "success",
        "www 🔍 verify | stage": "success",
        "www 🚀 Deploy | prod": "manual",
      },
    },
  },
};
