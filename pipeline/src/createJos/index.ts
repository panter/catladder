import { BUILD_TYPES } from "../build";
import { createContext } from "../context";
import { DEPLOY_TYPES } from "../deploy";
import { Config, PipelineTrigger } from "../types/config";
import { Context } from "../types/context";
import { GitlabJobDef, GitlabJobs } from "../types/gitlab-types";

const createRawJobs = (context: Context): GitlabJobs => {
  if (context.componentConfig.deploy === false) {
    return [];
  }
  const buildJobs =
    BUILD_TYPES[context.componentConfig.build.type].jobs(context);
  const deployJobs =
    DEPLOY_TYPES[context.componentConfig.deploy.type].jobs(context);

  return [...buildJobs, ...deployJobs];
};
const getFullJobName = (name: string, componentName: string, env?: string) => {
  if (env) {
    return `${env} ${componentName} ${name}`;
  }
  return `${componentName} ${name}`;
};

// replaces references to other jobs with the full name
// the full name contains the componentname and the env name (if any)
const replaceReferences = (
  def: GitlabJobDef,
  componentName: string,
  env?: string
): GitlabJobDef => {
  return {
    ...def,
    needs: def.needs?.map((n) => getFullJobName(n, componentName, env)),
    environment: def.environment?.on_stop
      ? {
          ...def.environment,
          on_stop: getFullJobName(def.environment.on_stop, componentName, env),
        }
      : def.environment,
    dependencies: def.dependencies?.map((n) =>
      getFullJobName(n, componentName, env)
    ),
  };
};

export const createJobs = (
  envs: string[],
  config: Config,
  componentName: string,
  trigger: PipelineTrigger
): Record<string, GitlabJobDef> => {
  return envs.reduce((acc, env) => {
    const context = createContext(componentName, config, env, trigger);
    const jobs = createRawJobs(context);
    return {
      ...acc,
      ...jobs.reduce((acc, { name, job, perEnv = true }) => {
        const def = job;

        return {
          ...acc,
          [getFullJobName(name, componentName, perEnv ? env : undefined)]:
            replaceReferences(def, componentName, perEnv ? env : undefined),
        };
      }, {}),
    };
  }, {});
};
