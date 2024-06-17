import { isObject, merge } from "lodash";
import { getInjectVarsScript } from "../../bash/getInjectVarsScript";
import { BASE_RETRY } from "../../defaults";
import type {
  CatladderJobWithContext,
  ComponentContext,
  GitlabJobDef,
  GitlabRule,
} from "../../types";
import type { CatladderJob, CatladderJobNeed } from "../../types/jobs";
import { notNil } from "../../utils";
import { collapseableSection } from "../../utils/gitlab";
import type { AllCatladderJobs } from "../createAllJobs";

export type AllGitlabJobs = {
  name: string;
  gitlabJob: GitlabJobDef;
  componentName: string;
  env: string;
}[];

export const GITLAB_ENVIRONMENT_URL_VARIABLE = "CL_GITLAB_ENVIRONMENT_URL";
const removeUndefined = (obj: GitlabJobDef): GitlabJobDef =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  ) as GitlabJobDef;
const getFullJobName = (
  name: string,
  componentName: string,
  env?: string | null,
) => {
  if (env) {
    return `${componentName} ${name} | ${env} `;
  }
  return `${componentName} ${name}`;
};

const getFullReferencedJobName = (
  referencedJobName: string,
  componentName: string,
  env: string,
  allJobs: AllCatladderJobs,
) => {
  const referencedJob = allJobs[componentName]?.[env]?.find(
    (j) => j.name === referencedJobName,
  );
  if (!referencedJob) {
    throw new Error(
      `unknown job referenced: '${referencedJobName}' from '${env}:${componentName}'`,
    );
  }
  const envToSet = referencedJob.envMode !== "none" ? env : null;
  return getFullJobName(referencedJobName, componentName, envToSet);
};

const getJobName = (need: CatladderJobNeed) =>
  isObject(need) ? need.job : need;

export const makeGitlabJob = (
  componentName: string,
  env: string,
  {
    environment,
    envMode,
    needsStages,
    needsOtherComponent,
    name,
    needs,
    jobTags,
    script,
    context,
    variables,
    runnerVariables,
    when,
    ...job
  }: CatladderJobWithContext<string>,
  allJobs: AllCatladderJobs,
  baseRules?: GitlabRule[],
): [fullName: string, job: GitlabJobDef] => {
  const stage = envMode === "stagePerEnv" ? `${job.stage} ${env}` : job.stage;

  const needsFromStages: CatladderJob["needs"] = needsStages?.flatMap((n) => {
    const referencedComponentName = componentName;
    const allJobNamesFromThatStage =
      allJobs[referencedComponentName]?.[env]
        ?.filter((j) => j.stage === n.stage)
        ?.map((j) => j.name) ?? [];

    return allJobNamesFromThatStage.map((job) => ({
      job,
      artifacts: n.artifacts ?? false,
      componentName: referencedComponentName,
    }));
  });
  const cleanedNeeds: CatladderJob["needs"] = [
    ...(needsFromStages ?? []),
    ...(needs ?? []),
    // pull in legacy needs from other component, which is now identical to needs
    ...(needsOtherComponent ?? []),
  ];

  const gitlabNeeds: GitlabJobDef["needs"] = cleanedNeeds
    ?.map((n) =>
      isObject(n)
        ? {
            job: getFullReferencedJobName(
              n.job,
              n.componentName ?? componentName,
              env,
              allJobs,
            ),
            artifacts: n.artifacts,
          }
        : getFullReferencedJobName(n, componentName, env, allJobs),
    ) // sort in a predictable manner for snapshot tests
    .sort((a, b) => getJobName(a).localeCompare(getJobName(b)));

  const deduplicatedGitlabNeeds: GitlabJobDef["needs"] = [
    ...new Map(gitlabNeeds.map((n) => [isObject(n) ? n.job : n, n])).values(),
  ];

  const fullJobName = getFullJobName(
    name,
    componentName,
    envMode !== "none" ? env : undefined,
  );

  // backwards compatibility, some may still use KUBERNETES_CPU_REQUEST, KUBERNETES_MEMORY_REQUEST, etc. in variables.
  // those should now be set in the runnerVariables as they don't work in the variables key of the catladder job, becuase those get injected
  const PIPELINE_RUNNER_VARIABLES = [
    "KUBERNETES_CPU_REQUEST",
    "KUBERNETES_MEMORY_REQUEST",
    "KUBERNETES_CPU_LIMIT",
    "KUBERNETES_MEMORY_LIMIT",
  ];
  // remove those from variables and add them to runnerVariables

  const varsInjectScripts = collapseableSection(
    "injectvars",
    "Injecting variables",
  )([
    ...getInjectVarsScript(
      // remove legacy variables
      Object.fromEntries(
        Object.entries(variables ?? {}).filter(
          ([key]) => !PIPELINE_RUNNER_VARIABLES.includes(key),
        ),
      ),
    ),
  ]);

  const legacyRunnerVariables = Object.fromEntries(
    Object.entries(variables ?? {}).filter(([key]) =>
      PIPELINE_RUNNER_VARIABLES.includes(key),
    ),
  );

  if (Object.keys(legacyRunnerVariables).length > 0) {
    console.warn(
      `Legacy variables detected in ${fullJobName}: ${Object.keys(
        legacyRunnerVariables,
      ).join(", ")}. Please move them to the runnerVariables key.`,
    );
  }
  const rules = [
    ...(job.rules ?? []),
    ...(baseRules
      ? baseRules.map((rule) => ({
          when: when,
          ...rule,
        }))
      : when
        ? [{ when }]
        : []),
  ];
  const modified = addGitlabEnvironment(
    context,
    environment,
    {
      ...job,
      rules: rules.length > 0 ? rules : undefined,
      variables: {
        ...legacyRunnerVariables,
        ...runnerVariables,
      },
      script: [...varsInjectScripts, ...(script?.filter(notNil) ?? [])],
      tags: jobTags,
      stage,

      // sort in a predictable manner for snapshot tests
      needs: deduplicatedGitlabNeeds,
      retry: BASE_RETRY,
      interruptible: true,
    },
    componentName,
    env,
    allJobs,
  );

  const gitlabJob: GitlabJobDef = removeUndefined(modified);

  return [fullJobName, gitlabJob];
};

const addGitlabEnvironment = (
  context: ComponentContext,
  environment: CatladderJob["environment"],
  job: GitlabJobDef,
  componentName: string,
  env: string, // TODO: we could actually pull this from contxt
  allJobs: AllCatladderJobs,
): GitlabJobDef => {
  if (!environment) {
    return job;
  }
  const { url, envType } = context.environment;
  const { on_stop, ...restEnvironment } = environment;
  // those can be dynamic, so we therefore have to do this: https://docs.gitlab.com/ee/ci/environments/#set-a-dynamic-environment-url

  const dotEnvFile = "gitlab_environment.env";

  const scriptToAdd = [
    `echo "${GITLAB_ENVIRONMENT_URL_VARIABLE}=${url}" >> ${dotEnvFile}`,
  ];

  // this is NOT a bashVariable since it NEEDS to be used as a string in gitlab
  const gitlabEnvironmentName =
    envType === "review"
      ? `${env}/$CI_COMMIT_REF_NAME/${componentName}` // FIXME: should be replaced with mr name as well
      : `${env}/${componentName}`;

  return {
    ...job,
    environment: {
      name: gitlabEnvironmentName,
      url: `$${GITLAB_ENVIRONMENT_URL_VARIABLE}`,
      ...(on_stop
        ? {
            on_stop: getFullReferencedJobName(
              on_stop,
              componentName,
              env,
              allJobs,
            ),
          }
        : {}),
      ...restEnvironment,
    },
    artifacts: merge(job.artifacts ?? {}, {
      reports: {
        dotenv: `${dotEnvFile}`,
      },
    }),

    script: [...(job.script ?? []), ...scriptToAdd],
  };
};

export const createGitlabJobs = async (
  allJobs: AllCatladderJobs,
  baseRules?: GitlabRule[],
): Promise<AllGitlabJobs> => {
  return Object.keys(allJobs).flatMap((componentName) => {
    const componentJobs = allJobs[componentName];
    return Object.keys(componentJobs).flatMap((env) => {
      const jobs = componentJobs[env];

      return jobs.flatMap((job) => {
        const [fullJobName, gitlabJob] = makeGitlabJob(
          componentName,
          env,
          job,
          allJobs,
          baseRules,
        );
        return {
          name: fullJobName,
          gitlabJob,
          componentName,
          env,
        };
      });
    });
  });
};
