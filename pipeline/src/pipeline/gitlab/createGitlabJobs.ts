import { isObject, merge } from "lodash";
import { getInjectVarsScript } from "../../bash/getInjectVarsScript";
import { BASE_RETRY } from "../../defaults";
import type {
  ComponentContext,
  Context,
  GitlabJobDef,
  GitlabRule,
  WorkspaceContext,
} from "../../types";
import type { CatladderJob, CatladderJobNeed } from "../../types/jobs";
import { notNil } from "../../utils";
import { collapseableSection } from "../../utils/gitlab";
import { removeUndefined } from "../../utils/removeUndefined";
import type { AllCatladderJobs } from "../createAllJobs";

export type GitlabJobWithContext = {
  gitlabJob: GitlabJobDef;
  context: Context | null;
};
export type AllGitlabJobs = (GitlabJobWithContext & { name: string })[];

export const GITLAB_ENVIRONMENT_URL_VARIABLE = "CL_GITLAB_ENVIRONMENT_URL";
const getFullJobName = ({
  type,
  name,
  baseName,
  allJobs,
  env,
}: {
  type: "component" | "workspace";
  name: string;
  baseName: string;
  allJobs: AllCatladderJobs;
  env?: string | null;
}) => {
  const shouldAddIcon = allJobs.workspaces.length > 0;
  const icon = type === "component" ? "🔹" : "🔸";
  const prefix = shouldAddIcon ? icon + " " : "";
  if (env) {
    return `${prefix}${baseName} ${name} | ${env} `;
  }
  return `${prefix}${baseName} ${name}`;
};

const getFullReferencedJobNameFromComponent = (
  referencedJobName: string,
  componentName: string,
  env: string,
  allJobs: AllCatladderJobs,
) => {
  const referencedJob = allJobs.components
    .find((j) => j.context.name === componentName && j.context.env === env)
    ?.jobs?.find((j) => j.name === referencedJobName);

  if (!referencedJob) {
    throw new Error(
      `unknown job referenced: '${referencedJobName}' from '${env}:${componentName}'`,
    );
  }
  const envToSet = referencedJob.envMode !== "none" ? env : null;
  return getFullJobName({
    type: "component",
    name: referencedJobName,
    baseName: componentName,
    env: envToSet,
    allJobs,
  });
};

const getFullReferencedJobNameFromWorkspace = (
  referencedJobName: string,
  workspaceName: string,
  env: string,
  allJobs: AllCatladderJobs,
) => {
  const referencedJob = allJobs.workspaces
    .find((w) => w.context.name === workspaceName)
    ?.jobs?.find((j) => j.name === referencedJobName);
  if (!referencedJob) {
    throw new Error(
      `unknown job referenced: '${referencedJobName}' from workspace ${env}:${workspaceName}'`,
    );
  }
  const envToSet = referencedJob.envMode !== "none" ? env : null;

  return getFullJobName({
    type: "workspace",
    name: referencedJobName,
    baseName: workspaceName,
    env: envToSet,
    allJobs,
  });
};

const getJobName = (need: CatladderJobNeed) =>
  isObject(need) ? need.job : need;

export const makeGitlabJob = (
  context: Context,
  job: CatladderJob<string>,
  allJobs: AllCatladderJobs,
  baseRules?: GitlabRule[],
): [fullName: string, job: GitlabJobDef] => {
  const {
    environment,
    envMode,
    needsStages,
    name,
    needs,
    jobTags,
    script,

    variables,
    runnerVariables,
    when,
    ...rest
  } = job;
  const stage =
    envMode === "stagePerEnv" ? `${job.stage} ${context.env}` : job.stage;

  const deduplicatedGitlabNeeds: GitlabJobDef["needs"] = getGitlabNeeds(
    context,
    job,
    allJobs,
  );

  const fullJobName = getFullJobName({
    type: context.type,
    name,
    baseName: context.name,
    env: envMode !== "none" ? context.env : undefined,
    allJobs,
  });

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

  const gitlabJob: GitlabJobDef = {
    ...rest,
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
  };
  const modified = addGitlabEnvironment(
    context,
    environment,
    gitlabJob,
    allJobs,
  );

  return [fullJobName, removeUndefined(modified)];
};

const addGitlabEnvironment = (
  context: Context,
  catladderJobEnvironment: CatladderJob["environment"],
  job: GitlabJobDef,
  allJobs: AllCatladderJobs,
): GitlabJobDef => {
  if (!catladderJobEnvironment) {
    return job;
  }
  if (context.type !== "component") {
    // don't add enviornment for workspace jobs atm.
    return job;
  }
  const { env, name, environment } = context;
  const { url, envType } = environment;
  const { on_stop, ...restEnvironment } = catladderJobEnvironment;
  // those can be dynamic, so we therefore have to do this: https://docs.gitlab.com/ee/ci/environments/#set-a-dynamic-environment-url

  const dotEnvFile = "gitlab_environment.env";

  const scriptToAdd = [
    `echo "${GITLAB_ENVIRONMENT_URL_VARIABLE}=${url}" >> ${dotEnvFile}`,
  ];

  // this is NOT a bashVariable since it NEEDS to be used as a string in gitlab
  const gitlabEnvironmentName =
    envType === "review"
      ? `${env}/$CI_COMMIT_REF_NAME/${name}` // FIXME: should be replaced with mr name as well
      : `${env}/${name}`;

  return {
    ...job,
    environment: {
      name: gitlabEnvironmentName,
      url: `$${GITLAB_ENVIRONMENT_URL_VARIABLE}`,
      ...(on_stop
        ? {
            on_stop: getFullReferencedJobNameFromComponent(
              on_stop,
              name,
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
  // TODO: add workspace jobs
  return [...allJobs.workspaces, ...allJobs.components].flatMap(
    ({ context, jobs }) => {
      return jobs.map((job) => {
        const [fullJobName, gitlabJob] = makeGitlabJob(
          context,
          job,
          allJobs,
          baseRules,
        );
        return {
          name: fullJobName,
          gitlabJob,
          context,
        };
      });
    },
  );
};

function getGitlabNeeds(
  context: Context,
  job: CatladderJob<string>,
  allJobs: AllCatladderJobs,
): GitlabJobDef["needs"] {
  const needs =
    context.type === "workspace"
      ? getGitlabNeedsForWorkspaceJob(context, job, allJobs)
      : getGitlabNeedsForComponentJob(context, job, allJobs);

  return deduplicateNeeds(needs);
}
function deduplicateNeeds(needs: GitlabJobDef["needs"]): GitlabJobDef["needs"] {
  return needs
    ? [...new Map(needs.map((n) => [isObject(n) ? n.job : n, n])).values()]
    : undefined;
}

function getGitlabNeedsForComponentJob(
  context: ComponentContext,
  { needsStages, needs }: CatladderJob<string>,
  allJobs: AllCatladderJobs,
): GitlabJobDef["needs"] {
  const needsFromStages = needsStages?.flatMap<CatladderJobNeed>((n) => {
    const componentName = context.name;
    if (!n.workspaceName) {
      const allJobNamesFromThatStage =
        allJobs.components
          .filter(
            (j) =>
              j.context.name === componentName && j.context.env === context.env,
          )
          .flatMap((j) => j.jobs)
          ?.filter((j) => j.stage === n.stage)
          ?.map((j) => j.name) ?? [];

      return allJobNamesFromThatStage.map((job) => ({
        job,
        artifacts: n.artifacts ?? false,
        componentName,
      }));
    } else {
      const allJobNamesFromThatStage =
        allJobs.workspaces
          .find(
            (w) =>
              w.context.name === n.workspaceName &&
              w.context.env === context.env,
          )
          ?.jobs?.flatMap((j) => j)
          ?.filter((j) => j.stage === n.stage)
          ?.map((j) => j.name) ?? [];

      return allJobNamesFromThatStage.map((job) => ({
        job,
        artifacts: n.artifacts ?? false,
        workspaceName: n.workspaceName,
      }));
    }
  });
  const cleanedNeeds: CatladderJob["needs"] = [
    ...(needsFromStages ?? []),
    ...(needs ?? []),
  ];

  return cleanedNeeds
    ?.map((n) =>
      isObject(n)
        ? "workspaceName" in n
          ? {
              job: getFullReferencedJobNameFromWorkspace(
                n.job,
                n.workspaceName,
                context.env,
                allJobs,
              ),
              artifacts: n.artifacts,
            }
          : {
              job: getFullReferencedJobNameFromComponent(
                n.job,
                n.componentName ?? context.name,
                context.env,
                allJobs,
              ),
              artifacts: n.artifacts,
            }
        : getFullReferencedJobNameFromComponent(
            n,
            context.name,
            context.env,
            allJobs,
          ),
    ) // sort in a predictable manner for snapshot tests
    .sort((a, b) => getJobName(a).localeCompare(getJobName(b)));
}
/**
 *
 *unclear whether we actually need this. So far jobs in a workspace don't have needs to other jobs from the same workspace
 */
function getGitlabNeedsForWorkspaceJob(
  context: WorkspaceContext,
  { needsStages, needs }: CatladderJob<string>,
  allJobs: AllCatladderJobs,
): GitlabJobDef["needs"] {
  const needsFromStages = needsStages?.flatMap<CatladderJobNeed>((n) => {
    const workspaceName = n.workspaceName ?? context.name;
    const allJobNamesFromThatStage =
      allJobs.workspaces
        .filter(
          (j) =>
            j.context.name === workspaceName && j.context.env === context.env,
        )
        .flatMap((j) => j.jobs)
        ?.filter((j) => j.stage === n.stage)
        ?.map((j) => j.name) ?? [];

    return allJobNamesFromThatStage.map((job) => ({
      job,
      artifacts: n.artifacts ?? false,
      workspaceName: workspaceName,
    }));
  });
  const cleanedNeeds: CatladderJob["needs"] = [
    ...(needsFromStages ?? []),
    ...(needs ?? []),
  ];

  return cleanedNeeds
    ?.map((n) =>
      isObject(n)
        ? {
            job: getFullReferencedJobNameFromWorkspace(
              n.job,
              "workspaceName" in n && n.workspaceName
                ? n.workspaceName
                : context.name,
              context.env,
              allJobs,
            ),
            artifacts: n.artifacts,
          }
        : getFullReferencedJobNameFromWorkspace(
            n,
            context.name,
            context.env,
            allJobs,
          ),
    ) // sort in a predictable manner for snapshot tests
    .sort((a, b) => getJobName(a).localeCompare(getJobName(b)));
}
