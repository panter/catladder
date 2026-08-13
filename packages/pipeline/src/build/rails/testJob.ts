import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../..";
import { getCiVariable } from "../../bash/ciVariables";
import type { CatladderJobSpec } from "../../types/jobs";
import { CatladderJob } from "../../types/jobs";
import { ensureArrayOrNull, notNil } from "../../utils";

export const createRailsTestJobs = (
  context: ComponentContext,
): CatladderJob[] => {
  // don't run tests after release
  // TODO: this will be replaced by using rules
  if (context.trigger === "taggedRelease") {
    return [];
  }

  // if its not a standalone build, we don't need to run tests
  if (!componentContextIsStandaloneBuild(context)) {
    return [];
  }

  const buildConfig = context.build.config;

  const base: Omit<CatladderJobSpec, "script" | "name"> = {
    variables: {
      ...context.environment.jobOnlyVars.build.envVars,
    },
    stage: "test",
    needs: [],
  };
  const defaultImage = "docker.io/ruby";
  const bundlerCacheDir = "tmp/cache";
  const bundlerInstall = [
    `bundle config set path '${bundlerCacheDir}'`,
    "bundle install -j $(nproc)",
  ];
  const bundlerCache = {
    key: {
      files: ["Gemfile.lock"],
      prefix: `${getCiVariable(context, "jobImage")}`, // a changed image might have different OS libraries which no longer work with the cached gems
    },
    paths: [bundlerCacheDir],
  };
  const auditJob: CatladderJob | null =
    buildConfig.audit !== false
      ? new CatladderJob({
          name: "🛡 audit",

          ...base,
          cache: undefined, // audit does not need bundle install and no cache
          image:
            buildConfig.audit?.jobImage ?? buildConfig.jobImage ?? defaultImage,
          script: [
            `cd ${context.build.dir}`,
            ...(ensureArrayOrNull(buildConfig.audit?.command) ?? [
              "gem install bundler-audit",
              "bundle audit check",
            ]),
          ],
          allow_failure: buildConfig.audit?.allowFailure ?? true,
        })
      : null;

  const lintJob: CatladderJob | null =
    buildConfig.lint !== false
      ? new CatladderJob({
          name: "👮 lint",

          ...base,
          cache: bundlerCache,
          image:
            buildConfig.lint?.jobImage ?? buildConfig.jobImage ?? defaultImage,
          script: [
            `cd ${context.build.dir}`,
            ...bundlerInstall,
            ...(ensureArrayOrNull(buildConfig.lint?.command) ?? [
              "bundle exec rubocop",
            ]),
          ],
          allow_failure: buildConfig.lint?.allowFailure,
        })
      : null;
  const testJob: CatladderJob | null =
    buildConfig.test !== false
      ? new CatladderJob({
          name: "🧪 test",

          ...base,
          cache: bundlerCache,
          image:
            buildConfig.test?.jobImage ?? buildConfig.jobImage ?? defaultImage,
          script: [
            `cd ${context.build.dir}`,
            ...bundlerInstall,
            ...(ensureArrayOrNull(buildConfig.test?.command) ?? [
              "bundle exec rake db:test:prepare",
              "bundle exec rake assets:precompile assets:clean",
              "bundle exec rspec",
            ]),
          ],
          allow_failure: buildConfig.test?.allowFailure,
          runnerVariables: {
            RAILS_ENV: "test",
            DATABASE_URL: "postgresql://postgres@database",
          },
          services: [
            {
              name:
                buildConfig.test && "databaseImage" in buildConfig.test
                  ? (buildConfig?.test?.databaseImage ??
                    "docker.io/postgres:latest")
                  : "docker.io/postgres:latest",
              alias: "database",
              variables: {
                POSTGRES_HOST_AUTH_METHOD: "trust",
              },
            },
          ],
        })
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
