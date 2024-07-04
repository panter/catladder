import type { Config } from "../src";

// the image version should match your `.ruby-version`
const RAILS_TEST_STAGE_IMAGE = "ruby:3.2.1";

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    app: {
      dir: ".",
      vars: {
        public: {
          RAILS_ENV: "production",
        },
        secret: ["SECRET_KEY_BASE"],
      },
      build: {
        type: "rails",
        test: {
          // if operating system dependencies are required you can either
          // - build a dedicated image
          // - use `command` to apt-get install them before running the test command
          jobImage: RAILS_TEST_STAGE_IMAGE,
        },
        lint: {
          jobImage: RAILS_TEST_STAGE_IMAGE,
        },
        audit: {
          jobImage: RAILS_TEST_STAGE_IMAGE,
        },
        // only needed if you do not have a Dockerfile
        cnbBuilder: {
          buildVars: { SECRET_KEY_BASE: "dummy-value" },
        },
      },
      deploy: {
        type: "kubernetes",
        cluster: {
          name: "some-cluster-name",
          region: "europe-west6",
          projectId: "some-project-id",
          type: "gcloud",
          domainCanonical: "panter.cloud",
        },
        values: {
          cloudsql: { enabled: true, projectId: "some-project-id" },
          application: {
            // if deployed to Google Cloud Run use a gem like cloudtasker instead of a permanently running expensive worker
            worker: {
              enabled: true,
              command: "launcher bundle exec rake jobs:work",
              // the delayed_job gem does not have a http health endpoint
              // disable probe to avoid worker restarts
              livenessProbe: false,
            },
          },
          jobs: {
            "db-migrate": {
              hook: "post-install,post-upgrade",
              command: "launcher bundle exec rake db:migrate",
            },
          },
        },
      },
      env: {
        review: {
          deploy: {
            values: {
              jobs: {
                "db-prepare-seed": {
                  hook: "post-install",
                  command: "launcher bundle exec rake db:prepare db:seed",
                },
                "db-migrate": {
                  hook: "post-upgrade",
                  command: "launcher bundle exec rake db:migrate",
                },
              },
            },
          },
        },
        prod: {
          host: "my-fancy-website.com",
        },
      },
    },
  },
};

export default config;

export const information = {
  title: "K8s: Rails with Worker",
};
