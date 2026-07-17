import { isEmpty, isObject, merge } from "lodash-es";
import { getInjectVarsScript } from "../../bash/getInjectVarsScript";
import { createJobCacheFromCacheConfigs } from "../../build/cache/createJobCache";
import { BASE_RETRY } from "../../defaults";
import type {
  AgentContext,
  ComponentContext,
  Context,
  GitlabJobDef,
  GitlabRule,
  WorkspaceContext,
  CatladderJobCache,
} from "../../types";
import type { CatladderJob, CatladderJobNeed } from "../../types/jobs";
import { notNil } from "../../utils";
import { collapseableSection } from "../../utils/gitlab";
import { removeUndefined } from "../../utils/removeUndefined";
import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import type { AllCatladderJobs } from "../../pipeline/createAllJobs";
import { getBashVariable } from "../../bash/BashExpression";
import { addCacheFallback } from "./cache";

export type GitlabJobWithContext = {
  gitlabJob: GitlabJobDef;
  context: Context | AgentContext | null;
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
  type: "component" | "workspace" | "agent";
  name: string;
  baseName: string;
  allJobs: AllCatladderJobs;
  env?: string | null;
}) => {
  const shouldAddIcon = allJobs.workspaces.length > 0;
  const icon = type === "component" ? "🔹" : type === "agent" ? "🤖" : "🔸";
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

  return getFullJobName({
    type: "component",
    name: referencedJobName,
    baseName: componentName,
    env,
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

  return getFullJobName({
    type: "workspace",
    name: referencedJobName,
    baseName: workspaceName,
    env,
    allJobs,
  });
};

const getJobName = (need: CatladderJobNeed) =>
  isObject(need) ? need.job : need;

export const makeGitlabJob = (
  context: Context | AgentContext,
  job: CatladderJob<string>,
  allJobs: AllCatladderJobs,
  images: JobImagesPlan,
  baseRules?: GitlabRule[],
): [fullName: string, job: GitlabJobDef] => {
  const {
    environment,
    envMode,
    requires,
    provides,
    name,
    needs,
    jobTags,
    script,

    variables,
    runnerVariables,
    gate,
    when: jobWhen,
    allow_failure: jobAllowFailure,
    cache: jobCache,
    caches,
    image: jobImage,
    ...rest
  } = job;

  // catladder image references resolve according to the jobImages mode;
  // in repo mode the job additionally depends on the image build job
  const resolvedImage = images.resolve(jobImage);
  const image = resolvedImage.image;
  const imageNeeds = resolvedImage.need ? [resolvedImage.need] : [];

  // the neutral `gate` translates to gitlab's when/allow_failure;
  // explicitly set gitlab fields take precedence
  const when =
    jobWhen ??
    (gate ? (gate === "manual" ? "manual" : "on_success") : undefined);
  const allow_failure =
    jobAllowFailure ?? (gate ? gate === "manual" : undefined);

  // the neutral `caches` declarations resolve to gitlab cache configs;
  // an explicitly set gitlab `cache` takes precedence. `keyFiles` is a
  // github-only content-key hint and must not leak into the gitlab yaml
  const stripKeyFiles = (
    resolved: CatladderJobCache | CatladderJobCache[],
  ): CatladderJobCache | CatladderJobCache[] =>
    Array.isArray(resolved)
      ? resolved.map(({ keyFiles: _keyFiles, ...cacheRest }) => cacheRest)
      : (({ keyFiles: _keyFiles, ...cacheRest }) => cacheRest)(resolved);
  const resolvedCaches =
    caches && context.type !== "agent"
      ? createJobCacheFromCacheConfigs(context, caches)
      : undefined;
  const cache = jobCache ?? (resolvedCaches && stripKeyFiles(resolvedCaches));

  const stage =
    envMode === "stagePerEnv" && context.type !== "agent"
      ? `${job.stage} ${context.env}`
      : job.stage;

  const deduplicatedGitlabNeeds: GitlabJobDef["needs"] = getGitlabNeeds(
    context,
    job,
    allJobs,
    imageNeeds,
  );

  const fullJobName = getFullJobName({
    type: context.type,
    name,
    baseName: context.name,
    env: context.type !== "agent" ? context.env : undefined,
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
    retry: BASE_RETRY,
    interruptible: true,
    ...rest,
    image,
    allow_failure,
    cache: cache ? addCacheFallback(cache, context) : undefined,
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
  context: Context | AgentContext,
  catladderJobEnvironment: CatladderJob["environment"],
  job: GitlabJobDef,
  allJobs: AllCatladderJobs,
): GitlabJobDef => {
  if (!catladderJobEnvironment) {
    return job;
  }
  if (context.type !== "component") {
    // don't add enviornment for workspace and agent jobs atm.
    return job;
  }
  const { env, name, environment } = context;
  const { envVars, envType } = environment;
  const { onStop, autoStopIn, action } = catladderJobEnvironment;
  // those can be dynamic, so we therefore have to do this: https://docs.gitlab.com/ee/ci/environments/#set-a-dynamic-environment-url

  const dotEnvFile = "gitlab_environment.env";
  const createsJobEnv =
    !catladderJobEnvironment.action ||
    catladderJobEnvironment.action === "start";

  const artifacts = merge(
    job.artifacts ?? {},
    createsJobEnv
      ? {
          reports: {
            dotenv: dotEnvFile,
          },
        }
      : {},
  );

  const scriptToAdd = [
    `echo "${GITLAB_ENVIRONMENT_URL_VARIABLE}=${getBashVariable("ROOT_URL")}" >> ${dotEnvFile}`,
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
      ...(createsJobEnv ? { url: `$${GITLAB_ENVIRONMENT_URL_VARIABLE}` } : {}),
      ...(onStop
        ? {
            on_stop: getFullReferencedJobNameFromComponent(
              onStop,
              name,
              env,
              allJobs,
            ),
          }
        : {}),
      ...(action ? { action } : {}),
      ...(autoStopIn ? { auto_stop_in: autoStopIn } : {}),
    },
    ...(!isEmpty(artifacts) ? { artifacts } : {}),
    script: [...(job.script ?? []), ...(createsJobEnv ? scriptToAdd : [])],
  };
};

export const createGitlabJobs = async (
  allJobs: AllCatladderJobs,
  images: JobImagesPlan,
  baseRules?: GitlabRule[],
): Promise<AllGitlabJobs> => {
  const contextualJobs = [
    ...allJobs.workspaces,
    ...allJobs.components,
    ...allJobs.agents,
  ].flatMap(({ context, jobs }) => {
    return jobs.map((job) => {
      const [fullJobName, gitlabJob] = makeGitlabJob(
        context,
        job,
        allJobs,
        images,
        baseRules,
      );
      return {
        name: fullJobName,
        gitlabJob,
        context,
      };
    });
  });

  // image build jobs (repo mode): no context, plain names, their
  // rules:changes combined with the trigger rules
  const imageJobs: AllGitlabJobs = images.getEnsureJobs().map((job) => ({
    name: job.name,
    gitlabJob: makeEnsureImageGitlabJob(job, baseRules),
    context: null,
  }));

  return [...imageJobs, ...contextualJobs];
};

/**
 * lowers an image build job: only runs when the (generated) image
 * definition changed, within the trigger's base rules
 */
const makeEnsureImageGitlabJob = (
  job: CatladderJob,
  baseRules?: GitlabRule[],
): GitlabJobDef => {
  const changes = job.rules?.[0]?.changes;
  const rules = (baseRules ?? []).map((baseRule) =>
    baseRule.when === "never" ? baseRule : { ...baseRule, changes },
  );

  return removeUndefined({
    retry: BASE_RETRY,
    interruptible: true,
    image: job.image as GitlabJobDef["image"],
    services: job.services,
    rules: rules.length > 0 ? rules : [{ changes }],
    variables: job.runnerVariables,
    script: job.script?.filter(notNil) ?? [],
    stage: job.stage,
    needs: [],
  });
};

function getGitlabNeeds(
  context: Context | AgentContext,
  job: CatladderJob<string>,
  allJobs: AllCatladderJobs,
  extraNeeds: CatladderJobNeed[] = [],
): GitlabJobDef["needs"] {
  const jobWithExtraNeeds =
    extraNeeds.length > 0
      ? { ...job, needs: [...extraNeeds, ...(job.needs ?? [])] }
      : job;
  const needs =
    context.type === "workspace"
      ? getGitlabNeedsForWorkspaceJob(context, jobWithExtraNeeds, allJobs)
      : context.type === "agent"
        ? mapAgentNeeds(jobWithExtraNeeds.needs)
        : getGitlabNeedsForComponentJob(context, jobWithExtraNeeds, allJobs);

  return needs ? deduplicateNeeds(needs) : undefined;
}

/**
 * agent jobs use their needs as-is; global needs (image build jobs)
 * keep their plain name and optional flag
 */
function mapAgentNeeds(
  needs: CatladderJobNeed[] | undefined,
): GitlabJobDef["needs"] | null {
  if (!needs) {
    return null;
  }
  return needs.map((n) =>
    isObject(n) && "global" in n && n.global
      ? {
          job: n.job,
          artifacts: n.artifacts,
          ...(n.optional ? { optional: true } : {}),
        }
      : (n as string | { job: string; artifacts: boolean }),
  );
}
function deduplicateNeeds(needs: GitlabJobDef["needs"]): GitlabJobDef["needs"] {
  return needs
    ? [...new Map(needs.map((n) => [isObject(n) ? n.job : n, n])).values()]
    : undefined;
}

function getGitlabNeedsForComponentJob(
  context: ComponentContext,
  { needs }: CatladderJob<string>,
  allJobs: AllCatladderJobs,
): GitlabJobDef["needs"] {
  return (needs ?? [])
    .map((n) =>
      isObject(n)
        ? "global" in n && n.global
          ? // global jobs (e.g. image builds) keep their plain name
            {
              job: n.job,
              artifacts: n.artifacts,
              ...(n.optional ? { optional: true } : {}),
            }
          : "workspaceName" in n && n.workspaceName
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
                  "componentName" in n
                    ? (n.componentName ?? context.name)
                    : context.name,
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
  { needs }: CatladderJob<string>,
  allJobs: AllCatladderJobs,
): GitlabJobDef["needs"] {
  return (needs ?? [])
    .map((n) =>
      isObject(n)
        ? "global" in n && n.global
          ? {
              job: n.job,
              artifacts: n.artifacts,
              ...(n.optional ? { optional: true } : {}),
            }
          : {
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
