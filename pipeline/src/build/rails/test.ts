import type { Context } from "../..";
import type { CatladderJob } from "../../types/jobs";
import { ensureArray, notNil } from "../../utils";

export const createRailsTestJobs = (context: Context): CatladderJob[] => {
  // don't run tests after release
  if (context.commitInfo?.trigger === "taggedRelease") {
    return [];
  }

  const buildConfig = context.componentConfig.build;

  const base: Omit<CatladderJob, "script" | "name"> = {
    variables: buildConfig.extraVars ?? {},
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
          image: buildConfig.audit?.jobImage ?? defaultImage,
          script: [
            `cd ${context.componentConfig.dir}`,
            ...(ensureArray(buildConfig.audit?.command) ?? [
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
          image: buildConfig.lint?.jobImage ?? defaultImage,
          script: [
            `cd ${context.componentConfig.dir}`,
            ...bundlerInstall,
            ...(ensureArray(buildConfig.lint?.command) ?? [
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
          image: buildConfig.test?.jobImage ?? defaultImage,
          script: [
            `cd ${context.componentConfig.dir}`,
            ...bundlerInstall,
            ...(ensureArray(buildConfig.test?.command) ?? [
              "bundle exec rspec",
            ]),
          ],
        }
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};
