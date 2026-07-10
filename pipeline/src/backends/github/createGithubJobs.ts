import { isObject } from "lodash-es";
import { getInjectVarsScript } from "../../bash/getInjectVarsScript";
import { createJobCacheFromCacheConfigs } from "../../build/cache/createJobCache";
import { getSecretVarName } from "../../context/getEnvironmentVariables";
import type { AllCatladderJobs } from "../../pipeline/createAllJobs";
import type { ComponentContext, Context } from "../../types";
import type {
  GithubJob,
  GithubService,
  GithubStep,
} from "../../types/github-types";
import type { CatladderJob, CatladderJobNeed } from "../../types/jobs";
import { ensureArray, notNil } from "../../utils";
import { collapseableSection } from "../../utils/gitlab";
import { getGithubScriptFunctionDefinitions } from "./scriptFunctions";
import type { JobImagesPlan } from "../../customImages/jobImagesPlan";
import type { GithubScriptFiles } from "./scriptFiles";
import { GITHUB_INJECTED_WORKFLOW_ENV } from "./ciVariables";

/**
 * runner variables that only make sense on gitlab runners and must not
 * leak into github jobs (docker-in-docker daemon config, kubernetes
 * executor resource requests, gitlab clone strategy)
 */
const GITLAB_ONLY_RUNNER_VARIABLES = new Set([
  "DOCKER_HOST",
  "DOCKER_TLS_CERTDIR",
  "DOCKER_DRIVER",
  "KUBERNETES_CPU_REQUEST",
  "KUBERNETES_MEMORY_REQUEST",
  "KUBERNETES_CPU_LIMIT",
  "KUBERNETES_MEMORY_LIMIT",
  "GIT_STRATEGY",
]);

/**
 * github runs docker natively on its runners, gitlab needs a
 * docker-in-docker service for it
 */
const isDindService = (image: string) => /(^|\/)docker:.*dind/.test(image);

const slug = (value: string) => {
  const slugged = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // job ids must start with a letter or _
  return /^[a-z_]/.test(slugged) ? slugged : `job-${slugged}`;
};

export const githubJobId = (context: Context, jobName: string) =>
  slug(
    `${context.type === "workspace" ? "ws-" : ""}${context.name}-${jobName}-${context.env}`,
  );

/** id of a job without component/workspace context (e.g. image builds) */
export const githubGlobalJobId = (jobName: string) => slug(jobName);

const githubJobName = (context: Context, jobName: string) =>
  `${context.name} ${jobName} | ${context.env}`;

type ResolvedNeed = { id: string; artifacts: boolean };

const resolveNeed = (
  context: Context,
  need: CatladderJobNeed,
  allJobs: AllCatladderJobs,
): ResolvedNeed => {
  const env = context.env;

  const findComponentJob = (componentName: string, jobName: string) => {
    const provider = allJobs.components.find(
      (c) => c.context.name === componentName && c.context.env === env,
    );
    const job = provider?.jobs.find((j) => j.name === jobName);
    if (!provider || !job) {
      throw new Error(
        `unknown job referenced: '${jobName}' from '${env}:${componentName}'`,
      );
    }
    return githubJobId(provider.context, jobName);
  };

  const findWorkspaceJob = (workspaceName: string, jobName: string) => {
    const provider = allJobs.workspaces.find(
      (w) => w.context.name === workspaceName && w.context.env === env,
    );
    const job = provider?.jobs.find((j) => j.name === jobName);
    if (!provider || !job) {
      throw new Error(
        `unknown job referenced: '${jobName}' from workspace '${env}:${workspaceName}'`,
      );
    }
    return githubJobId(provider.context, jobName);
  };

  if (isObject(need)) {
    if ("global" in need && need.global) {
      return { id: githubGlobalJobId(need.job), artifacts: need.artifacts };
    }
    if ("workspaceName" in need && need.workspaceName) {
      return {
        id: findWorkspaceJob(need.workspaceName, need.job),
        artifacts: need.artifacts,
      };
    }
    return {
      id: findComponentJob(
        ("componentName" in need ? need.componentName : undefined) ??
          context.name,
        need.job,
      ),
      artifacts: need.artifacts,
    };
  }
  return {
    id:
      context.type === "workspace"
        ? findWorkspaceJob(context.name, need)
        : findComponentJob(context.name, need),
    // plain string needs download artifacts by default (gitlab semantics)
    artifacts: true,
  };
};

export const resolveGithubNeeds = (
  context: Context,
  job: CatladderJob,
  allJobs: AllCatladderJobs,
  extraNeeds: CatladderJobNeed[] = [],
): ResolvedNeed[] => {
  const resolved = [...extraNeeds, ...(job.needs ?? [])].map((need) =>
    resolveNeed(context, need, allJobs),
  );
  // deduplicate by provider id, explicit entries win (they come last)
  return [...new Map(resolved.map((n) => [n.id, n])).values()].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
};

const createCacheSteps = (
  context: Context,
  job: CatladderJob,
): GithubStep[] => {
  if (!job.caches?.length) {
    return [];
  }
  const lowered = createJobCacheFromCacheConfigs(context, job.caches) ?? [];
  return ensureArray(lowered).map((cache) => {
    const paths = ensureArray(cache.paths ?? []);
    const key = cache.key;
    const { cacheKey, restoreKeyPrefix, label } =
      typeof key === "string" || key === undefined
        ? {
            // unique key per run so the cache is re-saved, restored via prefix
            cacheKey: `${key ?? "cache"}-\${{ github.run_id }}`,
            restoreKeyPrefix: `${key ?? "cache"}-`,
            label: key ?? "cache",
          }
        : {
            cacheKey: `${key.prefix ?? "files"}-\${{ hashFiles(${(
              key.files ?? []
            )
              .map((f) => `'${f}'`)
              .join(", ")}) }}`,
            restoreKeyPrefix: `${key.prefix ?? "files"}-`,
            label: key.prefix ?? (key.files ?? []).join(","),
          };
    return {
      name: `Cache ${label}`,
      // pull-only caches are restored but never saved
      uses:
        cache.policy === "pull"
          ? "actions/cache/restore@v4"
          : "actions/cache@v4",
      with: {
        path: paths.join("\n"),
        key: cacheKey,
        "restore-keys": restoreKeyPrefix,
      },
    };
  });
};

const getSecretsEnv = (context: ComponentContext): Record<string, string> => {
  const keys = [
    ...context.environment.secretEnvVarKeys,
    ...(context.environment.jobOnlyVars.build.secretEnvVarKeys ?? []),
    ...(context.environment.jobOnlyVars.deploy.secretEnvVarKeys ?? []),
  ];
  return Object.fromEntries(
    keys.map(({ key }) => {
      const name = getSecretVarName(context.env, context.name, key);
      return [name, `\${{ secrets.${name} }}`];
    }),
  );
};

/**
 * every CL_* variable the job script reads must exist in the job env.
 * On gitlab all project variables are implicitly available in every
 * job — cross-component references (`${other-component:KEY}`) rely on
 * that. Github jobs only see what is injected explicitly, so the
 * script is scanned for the names it actually references.
 */
const getReferencedSecretsEnv = (script: string): Record<string, string> =>
  Object.fromEntries(
    [...script.matchAll(/\$\{?(CL_[A-Za-z0-9_]+)\}?/g)]
      .map((match) => match[1])
      .filter((name) => !(name in GITHUB_INJECTED_WORKFLOW_ENV))
      .map((name) => [name, `\${{ secrets.${name} }}`]),
  );

export const makeGithubJob = (
  context: Context,
  job: CatladderJob,
  allJobs: AllCatladderJobs,
  uploadProviderIds: Set<string>,
  images: JobImagesPlan,
  scripts: GithubScriptFiles,
): [id: string, githubJob: GithubJob] => {
  const id = githubJobId(context, job.name);
  const isComponent = context.type === "component";

  const createsJobEnv =
    !!job.environment &&
    isComponent &&
    (!job.environment.action || job.environment.action === "start");

  const skipCheckout = job.runnerVariables?.GIT_STRATEGY === "none";

  const resolved = images.resolve(job.image);
  const needs = resolveGithubNeeds(
    context,
    job,
    allJobs,
    resolved.need ? [resolved.need] : [],
  );

  const image =
    typeof resolved.image === "string"
      ? resolved.image
      : Array.isArray(resolved.image)
        ? resolved.image[0]
        : resolved.image?.name;

  const runScript = [
    ...getGithubScriptFunctionDefinitions(),
    ...collapseableSection(
      "injectvars",
      "Injecting variables",
    )(getInjectVarsScript(job.variables ?? {})),
    ...(job.script?.filter(notNil) ?? []),
    ...(createsJobEnv ? [`echo "url=$ROOT_URL" >> "$GITHUB_OUTPUT"`] : []),
  ].join("\n");

  // scripts live in committed files to keep workflows under github's
  // 512 KB limit. Two classes of jobs must keep their script inline:
  // jobs without a checkout have no repo files, and `${{ }}` expressions
  // are only interpolated inside the workflow file itself.
  const run =
    skipCheckout || runScript.includes("${{")
      ? runScript
      : scripts.add(id, runScript);

  const artifactPaths = job.artifacts?.paths ?? [];

  const declaredServices = (job.services ?? []).map((service) =>
    typeof service === "string" ? { name: service } : service,
  );
  // docker runs natively on github runners: jobs that use a
  // docker-in-docker service on gitlab run directly on the runner here
  const usesHostDocker = declaredServices.some((service) =>
    isDindService(service.name),
  );

  const services = Object.fromEntries(
    declaredServices
      .filter((service) => !isDindService(service.name))
      .map((service): [string, GithubService] => [
        slug(
          "alias" in service && service.alias ? service.alias : service.name,
        ),
        {
          image: service.name,
          ...("variables" in service && service.variables
            ? { env: service.variables as Record<string, string> }
            : {}),
        },
      ]),
  );

  const env = {
    ...Object.fromEntries(
      Object.entries(job.runnerVariables ?? {}).filter(
        ([key]) => !GITLAB_ONLY_RUNNER_VARIABLES.has(key),
      ),
    ),
    ...(isComponent ? getSecretsEnv(context) : {}),
    ...getReferencedSecretsEnv(runScript),
    CL_JOB_IMAGE: image ?? "runner",
  };

  const githubJob: GithubJob = {
    name: githubJobName(context, job.name),
    "runs-on": "ubuntu-latest",
    ...(needs.length > 0 ? { needs: needs.map((n) => n.id) } : {}),
    ...(image && !usesHostDocker
      ? {
          container: {
            image,
            // private images in the repo's registry need credentials
            ...(resolved.fromRepoRegistry
              ? {
                  credentials: {
                    username: "${{ github.actor }}",
                    password: "${{ github.token }}",
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(Object.keys(services).length > 0 ? { services } : {}),
    ...(job.environment && isComponent
      ? {
          environment: {
            name:
              context.environment.envType === "review"
                ? `review-pr\${{ github.event.number }}-${context.name}`
                : `${context.env}-${context.name}`,
            ...(createsJobEnv ? { url: "${{ steps.main.outputs.url }}" } : {}),
          },
        }
      : {}),
    env,
    steps: [
      ...(skipCheckout
        ? []
        : [{ name: "Checkout", uses: "actions/checkout@v4" }]),
      ...createCacheSteps(context, job),
      ...needs
        .filter((n) => n.artifacts)
        .map((n) => ({
          name: `Download artifacts from ${n.id}`,
          uses: "actions/download-artifact@v4",
          with: { name: n.id },
        })),
      {
        name: job.name,
        id: "main",
        run,
        shell: "bash",
      },
      ...(uploadProviderIds.has(id) || artifactPaths.length > 0
        ? artifactPaths.length > 0
          ? [
              {
                name: "Upload artifacts",
                uses: "actions/upload-artifact@v4",
                with: {
                  name: id,
                  path: artifactPaths.join("\n"),
                  "if-no-files-found": "warn",
                },
              },
            ]
          : []
        : []),
    ],
  };

  return [id, githubJob];
};

/**
 * the ids of all jobs whose artifacts are consumed by other jobs
 * (they need an upload step)
 */
export const getUploadProviderIds = (
  allJobs: AllCatladderJobs,
): Set<string> => {
  const ids = new Set<string>();
  [...allJobs.workspaces, ...allJobs.components].forEach(({ context, jobs }) =>
    jobs.forEach((job) =>
      resolveGithubNeeds(context, job, allJobs)
        .filter((n) => n.artifacts)
        .forEach((n) => ids.add(n.id)),
    ),
  );
  return ids;
};
