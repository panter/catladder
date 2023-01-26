import type { Config } from "../src";
import { createAllPipelines } from "./__utils__/helpers";

// the image version should match your `.ruby-version`
const RAILS_TEST_STAGE_IMAGE = "ruby:3.2.1"

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
        secret: [
          "SECRET_KEY_BASE",
        ]
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
          application: {
            worker: {
              enabled: true,
              command: "/cnb/lifecycle/launcher bundle exec rake jobs:work",
            },
          },
          jobs: {
            "db-migrate": {
              hook: "post-install,post-upgrade",
              command:
                "/cnb/lifecycle/launcher bundle exec rake db:migrate",
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
                  command:
                    "/cnb/lifecycle/launcher bundle exec rake db:prepare db:seed",
                },
                "db-migrate": {
                  hook: "post-upgrade",
                  command:
                    "/cnb/lifecycle/launcher bundle exec rake db:migrate",
                },
              },
            },
          },
        },
        prod: {
          host: "my-fancy-website.com"
        }
      },
    },
  },
};

it("matches snapshot", async () => {
  expect(await createAllPipelines(config)).toMatchSnapshot();
});
