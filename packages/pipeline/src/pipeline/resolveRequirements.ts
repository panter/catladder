import type { ComponentContext, WorkspaceContext } from "../types";
import type {
  BaseStage,
  CapabilityName,
  CatladderJob,
  CatladderJobNeed,
  Requirement,
} from "../types/jobs";
import type { AllCatladderJobs } from "./createAllJobs";

/**
 * jobs that don't declare `provides` get a capability derived from
 * their stage. This keeps e.g. custom jobs in the test stage acting
 * as quality gates, like they did with the former stage-based needs.
 */
const DEFAULT_STAGE_CAPABILITIES: Partial<Record<BaseStage, CapabilityName>> = {
  build: "build",
  test: "qualityGate",
  deploy: "deployment",
};

/**
 * specific capabilities imply coarser ones, so that e.g. a requirement
 * on "build" (all build-ish jobs) also matches jobs that declare the
 * more specific "dockerImage"
 */
const CAPABILITY_IMPLICATIONS: Partial<
  Record<CapabilityName, CapabilityName[]>
> = {
  buildArtifacts: ["build"],
  dockerImage: ["build"],
};

const providesCapability = (job: CatladderJob, capability: CapabilityName) => {
  const stageDefault = DEFAULT_STAGE_CAPABILITIES[job.stage];
  const declared = job.provides ?? (stageDefault ? [stageDefault] : []);
  return declared.some(
    (c) =>
      c === capability ||
      (CAPABILITY_IMPLICATIONS[c] ?? []).includes(capability),
  );
};

/**
 * the planner: resolves the semantic `requires` declarations of all jobs
 * to concrete job dependencies (`needs`), now that all jobs of the
 * pipeline are known.
 *
 * A requirement expands to all jobs that provide the capability within
 * its scope (the job's own component or workspace by default).
 */
export const resolveRequirements = (
  allJobs: AllCatladderJobs,
): AllCatladderJobs => {
  allJobs.workspaces.forEach(({ context, jobs }) =>
    jobs.forEach((job) => resolveForJob(context, job, allJobs)),
  );
  allJobs.components.forEach(({ context, jobs }) =>
    jobs.forEach((job) => resolveForJob(context, job, allJobs)),
  );
  // agent jobs don't have requirements

  return allJobs;
};

const resolveForJob = (
  context: ComponentContext | WorkspaceContext,
  job: CatladderJob,
  allJobs: AllCatladderJobs,
) => {
  if (!job.requires?.length) {
    return;
  }
  const resolved = job.requires.flatMap((requirement) =>
    expandRequirement(context, job, requirement, allJobs),
  );
  // requirement-based needs come first, so that explicitly declared
  // needs win the later deduplication
  job.needs = [...resolved, ...(job.needs ?? [])];
};

const expandRequirement = (
  context: ComponentContext | WorkspaceContext,
  job: CatladderJob,
  requirement: Requirement,
  allJobs: AllCatladderJobs,
): CatladderJobNeed[] => {
  const { capability, artifacts, from, strict } = requirement;
  const env = context.env;

  const workspaceName =
    from?.workspace ??
    (!from && context.type === "workspace" ? context.name : undefined);

  const candidates = workspaceName
    ? allJobs.workspaces
        .filter(
          (w) => w.context.name === workspaceName && w.context.env === env,
        )
        .flatMap((w) => w.jobs)
    : allJobs.components
        .filter(
          (c) =>
            c.context.name === (from?.component ?? context.name) &&
            c.context.env === env,
        )
        .flatMap((c) => c.jobs);

  const providers = candidates.filter(
    (candidate) =>
      candidate !== job && providesCapability(candidate, capability),
  );

  // consuming artifacts from nobody is almost always a broken config
  const isStrict = strict ?? artifacts ?? false;

  if (isStrict && providers.length === 0) {
    throw new Error(
      `no job provides '${capability}' in '${env}:${
        workspaceName ?? from?.component ?? context.name
      }' (required by '${job.name}' of '${context.name}')`,
    );
  }

  return providers.map((provider) =>
    workspaceName
      ? {
          job: provider.name,
          artifacts: artifacts ?? false,
          workspaceName,
        }
      : {
          job: provider.name,
          artifacts: artifacts ?? false,
          componentName: from?.component ?? context.name,
        },
  );
};
