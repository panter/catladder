import { createArtifactsConfig } from "../build/base/createArtifactsConfig";
import { getNodeCache } from "../build/node/cache";
import { NODE_RUNNER_BUILD_VARIABLES } from "../build/node/constants";
import {
  ensureNodeVersion,
  getPackageManagerInstall,
} from "../build/node/packageManagerInstall";
import { isOfBuildType } from "../build/types";
import { getRunnerImage } from "../runner";
import type { ComponentContext, WorkspaceContext } from "../types/context";
import type { Requirement } from "../types/jobs";
import { CatladderJob } from "../types/jobs";
import { ensureArray } from "../utils";
import type { PostBuildTestConfig, PostBuildTestsConfig } from "./types";

export const POST_BUILD_TEST_STAGE = "post-build";

export const postBuildTestJobName = (name: string) => `🔬 ${name}`;

const getPostBuildTestsConfig = (
  context: ComponentContext | WorkspaceContext,
): PostBuildTestsConfig | undefined => {
  if (context.type === "workspace") {
    return context.build.config.postBuildTests;
  }
  if (context.build.type === "disabled") {
    return undefined;
  }
  return context.build.config.postBuildTests;
};

/**
 * whether the build output is a node project, so the job has to install
 * the dependencies before running the tests
 */
const isNodeBuild = (context: ComponentContext | WorkspaceContext) => {
  if (context.type === "workspace") {
    return true; // workspace builds are node builds
  }
  if (context.build.type === "fromWorkspace") {
    return true;
  }
  if (context.build.type === "standalone") {
    return isOfBuildType(
      context.build.config,
      "node",
      "node-static",
      "storybook",
      "meteor",
    );
  }
  return false;
};

const hasBuildCommand = (buildCommand: unknown) =>
  buildCommand !== null && buildCommand !== false;

/**
 * whether the build creates an app build job with artifacts. Rails builds
 * and builds with `buildCommand: false` only build the docker image.
 */
const hasBuildArtifacts = (context: ComponentContext | WorkspaceContext) => {
  if (context.type === "workspace") {
    return hasBuildCommand(context.build.config.buildCommand);
  }
  if (context.build.type === "fromWorkspace") {
    return hasBuildCommand(context.build.workspaceBuildConfig.buildCommand);
  }
  if (context.build.type === "standalone") {
    return (
      !isOfBuildType(context.build.config, "rails") &&
      hasBuildCommand(context.build.config.buildCommand)
    );
  }
  return false;
};

const getDefaultImage = (context: ComponentContext | WorkspaceContext) => {
  if (
    context.type === "component" &&
    context.build.type === "standalone" &&
    isOfBuildType(context.build.config, "custom")
  ) {
    // custom builds bring their own toolchain image
    return context.build.config.jobImage;
  }
  return getRunnerImage("jobs-default");
};

/**
 * jobs for `postBuildTests`: they run after the build in the `post-build`
 * stage, against the build artifacts, and act as quality gates, so a
 * failing post-build test blocks the deploy.
 */
export const createPostBuildTestJobs = async (
  context: ComponentContext | WorkspaceContext,
): Promise<CatladderJob[]> => {
  // like lint and test: tagged releases deploy what was already tested
  if (context.trigger === "taggedRelease") {
    return [];
  }
  const tests = Object.entries(getPostBuildTestsConfig(context) ?? {}).filter(
    (entry): entry is [string, PostBuildTestConfig] => entry[1] !== false,
  );
  if (tests.length === 0) {
    return [];
  }

  const nodeBuild = isNodeBuild(context);
  const [packageManagerInstall, nodeCache] = nodeBuild
    ? await Promise.all([
        getPackageManagerInstall(context),
        // pull-only: the build job is the designated cache writer
        getNodeCache(context, "pull"),
      ])
    : [null, null];

  // components built in a workspace test the workspace build output
  const from =
    context.type === "component" && context.build.type === "fromWorkspace"
      ? { workspace: context.build.workspaceName }
      : undefined;
  const buildRequirement: Requirement = hasBuildArtifacts(context)
    ? { capability: "buildArtifacts", artifacts: true, strict: true, from }
    : // no build artifacts (e.g. rails): run after the build (docker image)
      { capability: "build", artifacts: false, from };

  return tests.map(([name, test]) => {
    const artifactsConfig = createArtifactsConfig(
      context.build.dir,
      test.artifactsReports,
      test.artifacts,
    );
    return new CatladderJob({
      name: postBuildTestJobName(name),
      stage: POST_BUILD_TEST_STAGE,
      envMode: "stagePerEnv",
      provides: ["qualityGate"],
      needs: [],
      requires: [buildRequirement],
      image: test.jobImage ?? getDefaultImage(context),
      services: test.services,
      // neutral cache declarations, lowered by each backend
      caches: nodeCache ?? undefined,
      variables: {
        APP_PATH: context.build.dir,
        ...(context.type === "component"
          ? context.environment.jobOnlyVars.build.envVars
          : {}),
        ...(test.vars ?? {}),
      },
      runnerVariables: {
        ...(nodeBuild ? NODE_RUNNER_BUILD_VARIABLES : {}),
        ...(test.runnerVariables ?? {}),
      },
      script: [
        ...(nodeBuild ? ensureNodeVersion(context) : []),
        `cd ${context.build.dir}`,
        ...(packageManagerInstall ?? []),
        ...ensureArray(test.command),
      ],
      allow_failure: test.allowFailure,
      // reports and screenshots are most needed when the tests fail
      ...(artifactsConfig
        ? {
            artifacts: {
              when: "always",
              ...artifactsConfig.artifacts,
            },
          }
        : {}),
    });
  });
};

const jobIdOf = (jobName: string) =>
  jobName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * post-build test names are chosen by the user. Github job ids drop the
 * emoji of the job name, so e.g. a post-build test named `test` would
 * clash with the `🧪 test` job.
 */
export const assertUniquePostBuildTestNames = (
  context: ComponentContext | WorkspaceContext,
  postBuildTestJobs: CatladderJob[],
  otherJobs: CatladderJob[],
) => {
  const seenIds = new Set(otherJobs.map((job) => jobIdOf(job.name)));
  // also catches two post-build tests that only differ in case or
  // punctuation (e.g. `e2e` and `E2E`)
  const clash = postBuildTestJobs.find((job) => {
    const id = jobIdOf(job.name);
    const isClash = seenIds.has(id);
    seenIds.add(id);
    return isClash;
  });
  if (clash) {
    throw new Error(
      `${context.name}: post-build test '${clash.name}' clashes with another job of the same name, please rename it in postBuildTests`,
    );
  }
};
