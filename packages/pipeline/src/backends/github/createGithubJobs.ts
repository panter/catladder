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

/** step id of a referenceable cache restore step (see `cacheId`) */
const cacheStepId = (cacheId: string) =>
  `cache-${cacheId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

const createCacheSteps = (
  context: Context,
  job: CatladderJob,
): GithubStep[] => {
  if (!job.caches?.length) {
    return [];
  }
  const lowered = ensureArray(
    createJobCacheFromCacheConfigs(context, job.caches) ?? [],
  );

  // caches marked redundantOnExactHitOf skip their (expensive) restore
  // when the referenced sibling cache hit its exact key — e.g. the yarn
  // zip cache is never read when node_modules restored for the same
  // lockfile. The referenced cache's step must come first (its
  // `cache-hit` output drives the `if`), so providers are emitted
  // before dependents; the reorder is github-only and does not affect
  // the gitlab cache list.
  const referencedIds = new Set(
    lowered
      .map((cache) => cache.redundantOnExactHitOf)
      .filter((id): id is string => !!id),
  );
  const providedIds = new Set(
    lowered.map((cache) => cache.cacheId).filter((id): id is string => !!id),
  );
  const ordered = [
    ...lowered.filter((cache) => !cache.redundantOnExactHitOf),
    ...lowered.filter((cache) => cache.redundantOnExactHitOf),
  ];

  return ordered.map((cache) => {
    const paths = ensureArray(cache.paths ?? []);
    const key = cache.key;
    const { cacheKey, restoreKeyPrefix, label } =
      typeof key === "string" || key === undefined
        ? cache.keyFiles?.length
          ? {
              // content-keyed: an unchanged hash is an exact hit and the
              // cache is never re-saved (no per-run copies, no races
              // between parallel jobs saving the same key)
              cacheKey: `${key ?? "cache"}-\${{ hashFiles(${cache.keyFiles
                .map((f) => `'${f}'`)
                .join(", ")}) }}`,
              restoreKeyPrefix: `${key ?? "cache"}-`,
              label: key ?? "cache",
            }
          : {
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
    // the sibling-hit condition only applies when the referenced cache
    // is actually part of this job — otherwise restore unconditionally
    const skipCondition =
      cache.redundantOnExactHitOf &&
      providedIds.has(cache.redundantOnExactHitOf)
        ? `\${{ steps.${cacheStepId(cache.redundantOnExactHitOf)}.outputs.cache-hit != 'true' }}`
        : undefined;

    return {
      name: `Cache ${label}`,
      // referenced caches carry an id so dependents can read cache-hit
      ...(cache.cacheId && referencedIds.has(cache.cacheId)
        ? { id: cacheStepId(cache.cacheId) }
        : {}),
      ...(skipCondition ? { if: skipCondition } : {}),
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

export type SecretKinds = Map<string, "secret" | "variable">;

/**
 * how a vault-stored value reaches the job env: masked github secret,
 * or plain (unmasked) github variable for non-sensitive values — those
 * stay readable in logs and usable in environment urls
 */
const vaultValueExpression = (name: string, kinds: SecretKinds): string =>
  kinds.get(name) === "variable"
    ? `\${{ vars.${name} }}`
    : `\${{ secrets.${name} }}`;

/**
 * the kind of every vault-stored var of all components, keyed by its
 * CL_* name — the lookup for cross-component references
 */
export const collectSecretKinds = (allJobs: AllCatladderJobs): SecretKinds => {
  const kinds: SecretKinds = new Map();
  allJobs.components.forEach(({ context }) => {
    const entries = [
      ...context.environment.secretEnvVarKeys,
      ...(context.environment.jobOnlyVars.build.secretEnvVarKeys ?? []),
      ...(context.environment.jobOnlyVars.deploy.secretEnvVarKeys ?? []),
    ];
    entries.forEach(({ key, kind }) =>
      kinds.set(
        getSecretVarName(context.env, context.name, key),
        kind ?? "secret",
      ),
    );
  });
  return kinds;
};

const getSecretsEnv = (
  context: ComponentContext,
  kinds: SecretKinds,
): Record<string, string> => {
  const keys = [
    ...context.environment.secretEnvVarKeys,
    ...(context.environment.jobOnlyVars.build.secretEnvVarKeys ?? []),
    ...(context.environment.jobOnlyVars.deploy.secretEnvVarKeys ?? []),
  ];
  return Object.fromEntries(
    keys.map(({ key }) => {
      const name = getSecretVarName(context.env, context.name, key);
      return [name, vaultValueExpression(name, kinds)];
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
const getReferencedSecretsEnv = (
  script: string,
  kinds: SecretKinds,
): Record<string, string> =>
  Object.fromEntries(
    [...script.matchAll(/\$\{?(CL_[A-Za-z0-9_]+)\}?/g)]
      .map((match) => match[1])
      .filter((name) => !(name in GITHUB_INJECTED_WORKFLOW_ENV))
      .map((name) => [name, vaultValueExpression(name, kinds)]),
  );

export const makeGithubJob = (
  context: Context,
  job: CatladderJob,
  allJobs: AllCatladderJobs,
  uploadProviderIds: Set<string>,
  images: JobImagesPlan,
  scripts: GithubScriptFiles,
  secretKinds: SecretKinds = new Map(),
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

  // github pages: the built site is handed to the official actions
  // instead of being uploaded as a plain artifact. `deploy-pages`
  // replaces the whole site, so there is no path_prefix equivalent —
  // review previews are rejected upstream (see the pages deploy type).
  const pagesPublishDir = job.pages ? artifactPaths[0] : undefined;

  const declaredServices = (job.services ?? []).map((service) =>
    typeof service === "string" ? { name: service } : service,
  );
  // docker runs natively on github runners, so gitlab's docker-in-docker
  // services are dropped. The job container stays: the runner mounts the
  // host's docker socket into it, and images like docker-build carry the
  // helper scripts (ensure*Dockerfile etc.) the job scripts rely on.

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
    ...(isComponent ? getSecretsEnv(context, secretKinds) : {}),
    ...getReferencedSecretsEnv(runScript, secretKinds),
    CL_JOB_IMAGE: image ?? "runner",
  };

  /**
   * the github environment of the job — serving two purposes:
   * deployment tracking on deploy jobs, and access to environment
   * secrets (the repo-level cap of 100 secrets doesn't scale to
   * multiple envs). Names are keyed by env NAME, never env type: an
   * app can have several envs of the same type.
   *
   * - deploy jobs: `<env>-<component>` — static (unlike the former
   *   per-PR review names), so environment secrets can attach, and
   *   each component keeps its own deployment badge/url in the
   *   github ui. For review, PRs share the component's environment:
   *   a newer PR's deploy marks the previous one Inactive (the badge,
   *   not the app) — the price of a static name.
   * - other jobs referencing secrets join the shared `<env>`
   *   environment — deliberately NOT the per-component one, whose
   *   Active deploy badge their deployment records would displace.
   *   NOTE: build-time and deploy-time vars are not differentiated
   *   yet, so this environment holds roughly ALL of the env's
   *   secrets (the build's dotenv references every component).
   * - jobs without secret references get no environment
   */
  const referencesSecrets = Object.values(env).some(
    (value) =>
      typeof value === "string" &&
      (value.includes("${{ secrets.") || value.includes("${{ vars.")),
  );
  const githubEnvironment = pagesPublishDir
    ? // github requires pages deployments to target the `github-pages`
      // environment, and only the deploy step knows the final url.
      // `secrets-sync-github` derives its targets from the generated
      // workflows, so any secret this job references is synced there.
      {
        name: "github-pages",
        url: "${{ steps.deployment.outputs.page_url }}",
      }
    : job.environment && isComponent
      ? {
          name: `${context.env}-${context.name}`,
          ...(createsJobEnv ? { url: "${{ steps.main.outputs.url }}" } : {}),
        }
      : referencesSecrets
        ? { name: context.env }
        : undefined;

  const githubJob: GithubJob = {
    name: githubJobName(context, job.name),
    "runs-on": "ubuntu-latest",
    ...(needs.length > 0 ? { needs: needs.map((n) => n.id) } : {}),
    ...(image
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
    ...(githubEnvironment ? { environment: githubEnvironment } : {}),
    ...(pagesPublishDir
      ? {
          // declaring permissions drops ALL default token grants, so
          // everything this job needs beyond deploy-pages must be
          // re-granted: `contents: read` for the checkout and
          // `packages: read` to pull the job image from the repo registry
          permissions: {
            contents: "read",
            ...(resolved.fromRepoRegistry ? { packages: "read" } : {}),
            pages: "write",
            "id-token": "write",
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
      ...(pagesPublishDir
        ? [
            {
              name: "Upload pages artifact",
              uses: "actions/upload-pages-artifact@v3",
              with: { path: pagesPublishDir },
            },
            {
              name: "Deploy to github pages",
              id: "deployment",
              uses: "actions/deploy-pages@v4",
            },
          ]
        : []),
      ...(pagesPublishDir
        ? []
        : uploadProviderIds.has(id) || artifactPaths.length > 0
          ? artifactPaths.length > 0
            ? [
                {
                  name: "Upload artifacts",
                  uses: "actions/upload-artifact@v4",
                  with: {
                    name: id,
                    path: artifactPaths.join("\n"),
                    "if-no-files-found": "warn",
                    // gitlab artifacts include everything; upload-artifact
                    // silently drops hidden files by default — which is
                    // exactly where next.js builds live (.next)
                    "include-hidden-files": true,
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
