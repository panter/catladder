import {
  GitlabJobDef,
  GitlabJobCache,
  GitlabJobs,
  Retry,
  GitlabJob,
} from "../types/gitlab-types";
import { Context } from "../types/context";
import { createDockerBuildJob, DOCKER_BUILD_JOB_NAME } from "./docker";
import { isOfBuildType } from "./types";
import { ensureArray, notNil } from "../utils";

const NODE_RUNNER_BUILD_VARIABLES = {
  KUBERNETES_CPU_REQUEST: "0.5",
  KUBERNETES_CPU_LIMIT: "2",
  KUBERNETES_MEMORY_REQUEST: "1Gi",
  KUBERNETES_MEMORY_LIMIT: "2Gi",
};
const APP_BUILD_JOB_NAME = "🔨 app";
const baseRetry: Retry = {
  max: 2,
  when: ["runner_system_failure", "stuck_or_timeout_failure"],
};

const getYarnInstall = (context: Context) => [
  `cd ${context.componentConfig.dir}`,
  "if [ -f ./.nvmrc ]; then source /root/.nvm/nvm.sh && nvm install <<< .nvmrc; fi",
  "yarn install --frozen-lockfile",
];
export const getNodeCache = (policy = "pull-push"): GitlabJobCache[] => [
  {
    key: "node-modules",
    policy: policy,
    paths: [".yarn", "node_modules", "**/node_modules/"],
  },
];

const getNextCache = (context: Context): GitlabJobCache[] => [
  {
    key: "next-cache",
    policy: "pull-push",
    paths: [context.componentConfig.dir + "/.next/cache/"],
  },
];
const createNodeTestJobs = (context: Context): GitlabJobs => {
  // don't run tests after release
  if (context.commitInfo?.trigger === "taggedRelease") {
    return [];
  }

  const buildConfig = context.componentConfig.build;

  const base: Omit<GitlabJobDef, "script"> = {
    variables: {
      APP_PATH: context.componentConfig.dir,
      ...NODE_RUNNER_BUILD_VARIABLES,
      ...(buildConfig.extraVars ?? {}),
    },

    stage: "test",
    interruptible: true,
    needs: [],
    retry: baseRetry,
  };
  const yarnInstall = getYarnInstall(context);
  const auditJob: GitlabJob | null =
    buildConfig.audit !== false
      ? {
          name: "🛡 audit",
          envMode: "none",
          job: {
            ...base,
            cache: undefined, // audit does not need yarn install and no cache
            script: ensureArray(buildConfig.audit?.command) ?? ["yarn audit"],
            allow_failure: true,
          },
        }
      : null;

  const lintJob: GitlabJob | null =
    buildConfig.lint !== false
      ? {
          name: "👮 lint",
          envMode: "none",
          job: {
            ...base,
            cache: getNodeCache("pull-push"),
            script: [
              ...yarnInstall,
              ...(ensureArray(buildConfig.lint?.command) ?? ["yarn lint"]),
            ],
          },
        }
      : null;
  const testJob: GitlabJob | null =
    buildConfig.test !== false
      ? {
          name: "🧪 test",
          envMode: "none",
          job: {
            ...base,
            cache: getNodeCache("pull-push"),
            script: [
              ...yarnInstall,
              ...(ensureArray(buildConfig.test?.command) ?? ["yarn test"]),
            ],
          },
        }
      : null;
  return [auditJob, lintJob, testJob].filter(notNil);
};

const createNodeBuildJobs = (context: Context): GitlabJobs => {
  const buildConfig = context.componentConfig.build;

  if (
    !isOfBuildType(buildConfig, "node") &&
    !isOfBuildType(buildConfig, "node-static") &&
    !isOfBuildType(buildConfig, "storybook")
  ) {
    // should not happen
    throw new Error("deploy config is not node or node-static or storybook");
  }

  const buildInfo = [
    ". getCommitInfo", // TODO: inline
    `echo '{"id":"'$BUILD_ID'","commit":"'$BUILD_COMMIT'","tag":"'$BUILD_TAG'","time":"'$BUILD_TIME'"}' > ${context.componentConfig.dir}/__build_info.json`,
  ];

  const yarnInstall = getYarnInstall(context);
  const appBuildJob: GitlabJob | null =
    buildConfig.buildCommand !== null
      ? {
          name: APP_BUILD_JOB_NAME,
          envMode: "jobPerEnv",
          job: {
            needs: [],
            cache: [
              ...getNodeCache("pull"), // we only pull in app build, to make it a bit faster by not pushing it. push is done by test and lint
              ...getNextCache(context),
            ],
            variables: {
              ...NODE_RUNNER_BUILD_VARIABLES,
              ...context.environment.envVars,
              ...(context.componentConfig.build.extraVars ?? {}),
            },
            retry: baseRetry,
            interruptible: true,
            stage: "build",
            script: [
              ...buildInfo,
              ...yarnInstall,
              ...(ensureArray(buildConfig.buildCommand) ?? []),
            ],
            artifacts: {
              paths: [
                context.componentConfig.dir + "/__build_info.json",
                context.componentConfig.dir + "/dist",
                context.componentConfig.dir + "/.next",
              ],
            },
          },
        }
      : null;
  return [
    ...(appBuildJob ? [appBuildJob] : []),
    {
      name: DOCKER_BUILD_JOB_NAME,
      envMode: "jobPerEnv",
      job: {
        ...createDockerBuildJob(context, {
          script: [
            buildConfig.type === "node-static" ||
            buildConfig.type === "storybook"
              ? "ensureNginxDockerfile"
              : "ensureNodeDockerfile",
          ], // TOOD: inline
        }),
        needs: appBuildJob ? [APP_BUILD_JOB_NAME] : [],
      },
    },
  ];
};

export const createStorybookJobs = (context: Context): GitlabJobs => {
  return [...createNodeBuildJobs(context)];
};
export const createNodeJobs = (context: Context): GitlabJobs => {
  return [...createNodeTestJobs(context), ...createNodeBuildJobs(context)];
};
