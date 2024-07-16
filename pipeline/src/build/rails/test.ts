import {
  componentContextIsStandaloneBuild,
  type ComponentContext,
} from "../..";
import type { CatladderJob } from "../../types/jobs";
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

  const base: Omit<CatladderJob, "script" | "name"> = {
    variables: {
      ...context.environment.jobOnlyVars.build.envVars,
      ...(buildConfig.extraVars ?? {}),
    },
    stage: "test",
    needs: [],
    envMode: "none",
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
      prefix: "$CI_JOB_IMAGE", // a changed image might have different OS libraries which no longer work with the cached gems
    },
    paths: [bundlerCacheDir],
  };
  const auditJob: CatladderJob | null =
    buildConfig.audit !== false
      ? {
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
          allow_failure: true,
        }
      : null;

  const lintJob: CatladderJob | null =
    buildConfig.lint !== false
      ? {
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
        }
      : null;
  const testJob: CatladderJob | null =
    buildConfig.test !== false
      ? {
          name: "🧪 test",

          ...base,
          cache: bundlerCache,
          image:
            buildConfig.test?.jobImage ?? buildConfig.jobImage ?? defaultImage,
          script: [
            `cd ${context.build.dir}`,
            ...bundlerInstall,
            ...(ensureArrayOrNull(buildConfig.test?.command) ?? [
              "bundle exec rspec",
            ]),
          ],
        }
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
