import type { Config } from "../src";
import type { CatladderJob } from "../src/types/jobs";

const APP_GEM_CACHE: CatladderJob["cache"] = [
  {
    key: {
      files: ["app/Gemfile.lock"],
    },
    paths: ["app/vendor"],
  },
];

const config: Config = {
  appName: "test-app",
  customerName: "pan",
  components: {
    app: {
      dir: "app",
      dotEnv: true,
      vars: {
        public: {
          GRAPHQL_URL: "${api:ROOT_URL}/graphql",
        },
        secret: [
          "APP_STORE_CONNECT_API_KEY_CONTENT",
          "APP_STORE_CONNECT_ISSUER_ID",
          "APP_STORE_CONNECT_API_KEY_ID",
        ],
      },
      build: {
        extraVars: {
          LC_A: "L=en_US.UTF-8",
          LANG: "en_US.UTF-8",
        },
        type: "node",
        buildCommand: [
          "bundle config set --local path 'vendor/ruby'",
          "gem install bundler",
          "bundle install",
          "bundle exec pod install --project-directory=ios",
          "bundle exec fastlane build",
        ],
        jobTags: ["mac-runner"],
        jobCache: APP_GEM_CACHE,
      },

      deploy: {
        type: "custom",
        extraVars: {
          LC_A: "L=en_US.UTF-8",
          LANG: "en_US.UTF-8",
        },
        requiresDocker: false,
        script: [
          "bundle config set --local path 'vendor/ruby'",
          "gem install bundler",
          "bundle install",
          "bundle exec fastlane deploy_test",
        ],
        jobTags: ["mac-runner"],
        jobCache: APP_GEM_CACHE,
      },
    },

    api: {
      dir: "api",
      build: {
        type: "node",
      },
      deploy: {
        type: "google-cloudrun",
        projectId: "asdf",
        region: "asia-east1",
      },
    },
  },
};

export default config;
