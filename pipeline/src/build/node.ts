import {
  GitlabJobDef,
  GitlabJobCache,
  GitlabJobs,
  Retry,
  GitlabJob,
} from "../types/gitlab-types";
import { Context } from "../types/context";
import { createDockerBuildJob } from "./docker";
import { isOfType } from "./types";

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
export const getNodeCache = (): GitlabJobCache[] => [
  {
    key: "node-modules",
    policy: "pull-push",
    paths: ["node_modules", "**/node_modules/"],
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
  const base: Omit<GitlabJobDef, "script"> = {
    variables: {
      APP_PATH: context.componentConfig.dir,
    },
    cache: getNodeCache(),
    stage: "test",
    interruptible: true,
    needs: [],
    retry: baseRetry,
  };
  const yarnInstall = getYarnInstall(context);
  return [
    {
      name: "🛡 audit",
      perEnv: false,
      job: {
        ...base,
        script: [...yarnInstall, "yarn audit"],
        allow_failure: true,
      },
    },
    {
      name: "👮 lint",
      perEnv: false,
      job: {
        ...base,
        script: [...yarnInstall, "yarn lint"],
      },
    },
    {
      name: "🧪 test",
      perEnv: false,
      job: {
        ...base,
        script: [...yarnInstall, "yarn test"],
      },
    },
  ];
};

const createNodeBuildJobs = (context: Context): GitlabJobs => {
  const buildConfig = context.componentConfig.build;

  if (
    !isOfType(buildConfig, "node") &&
    !isOfType(buildConfig, "node-static") &&
    !isOfType(buildConfig, "storybook")
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
          job: {
            needs: [],
            cache: [...getNodeCache(), ...getNextCache(context)],
            variables: context.environment.variables,
            retry: baseRetry,
            interruptible: true,
            stage: "build",
            script: [
              ...buildInfo,
              ...yarnInstall,
              ...(Array.isArray(buildConfig.buildCommand)
                ? buildConfig.buildCommand
                : [buildConfig.buildCommand]),
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
      name: "🔨 docker",

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
