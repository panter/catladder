import { readdir, rm, unlink } from "fs/promises";
import { join } from "path";
import { createAllJobs } from "../../pipeline/createAllJobs";
import type { Config, Context, PipelineTrigger } from "../../types";
import { ALL_PIPELINE_TRIGGERS } from "../../types/config";
import type { GithubJob, GithubWorkflow } from "../../types/github-types";
import type { CatladderJob } from "../../types/jobs";
import type { PipelineBackend, PipelineFile } from "../types";
import { GITHUB_INJECTED_WORKFLOW_ENV } from "./ciVariables";
import { getPipelineOptions } from "../index";
import {
  collectSecretKinds,
  getUploadProviderIds,
  makeGithubJob,
} from "./createGithubJobs";
import { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { makeEnsureImageGithubJobs } from "./ensureImageJobs";
import { getCatciGeneratedFiles } from "../../catci/shippedCatci";
import {
  getGithubCreateReleaseWorkflow,
  getGithubReleaseCheckJobs,
  getGithubReleaseJobs,
  getGithubReleaseOnGreenWorkflow,
} from "./githubReleaseJobs";
import { GITHUB_SCRIPTS_FOLDER, GithubScriptFiles } from "./scriptFiles";

const WORKFLOWS_FOLDER = ".github/workflows";

/**
 * generated workflow files are prefixed so that cleanup never touches
 * user-maintained workflows in the same folder
 */
const GENERATED_FILE_PREFIX = "catladder-";

// NOTE on the emoji prefixes: github sorts the Actions sidebar by raw
// code point, so the prefix decides the order. 🛠️ (U+1F6E0) is the
// highest, which keeps the pipeline workflows below the triggerable
// action workflows (↩️ ▶️ 🚀 🛑) — the things a human clicks come
// first, and 🛑 (U+1F6D1) puts the stop actions after ▶️ deploy.
const TRIGGER_WORKFLOWS: Record<
  PipelineTrigger,
  Pick<GithubWorkflow, "name" | "on" | "concurrency">
> = {
  mr: {
    name: "🛠️ catladder review",
    on: { pull_request: { types: ["opened", "synchronize", "reopened"] } },
    concurrency: {
      group: "catladder-review-${{ github.event.number }}",
      "cancel-in-progress": true,
    },
  },
  mainBranch: {
    name: "🛠️ catladder main",
    // TODO: make the default branch configurable
    on: { push: { branches: ["main"] } },
  },
  taggedRelease: {
    name: "🛠️ catladder release",
    // tags pushed with the default GITHUB_TOKEN (as the release job
    // does) don't trigger `on: push: tags` — the release job therefore
    // also dispatches this workflow explicitly for the new tag
    on: { push: { tags: ["v*"] }, workflow_dispatch: {} },
  },
};

export class GithubBackend implements PipelineBackend {
  readonly type = "github" as const;

  async cleanup() {
    const entries = await readdir(WORKFLOWS_FOLDER).catch(() => []);
    await Promise.all(
      entries
        .filter((file) => file.startsWith(GENERATED_FILE_PREFIX))
        .map((file) => unlink(join(WORKFLOWS_FOLDER, file))),
    );
    await rm(GITHUB_SCRIPTS_FOLDER, { recursive: true, force: true });
  }

  async createFiles(config: Config): Promise<PipelineFile[]> {
    const images = this.createImagesPlan(config);
    const scripts = new GithubScriptFiles();
    const workflows = await this.createWorkflows(config, images, scripts);

    return [
      ...Object.entries(workflows).map(([fileName, workflow]) => ({
        path: join(WORKFLOWS_FOLDER, fileName),
        content: workflow as unknown as Record<string, unknown>,
      })),
      // materialized job scripts and image definitions (repo mode)
      ...scripts.getGeneratedFiles(),
      ...images.getGeneratedFiles(),
      // catci: the CI companion the release job's security audit runs
      ...getCatciGeneratedFiles(),
    ];
  }

  private createImagesPlan(config: Config): JobImagesPlan {
    return new JobImagesPlan(this.type, config.images);
  }

  /**
   * all workflows keyed by file name, mainly for testing purposes
   */
  async createWorkflows(
    config: Config,
    images: JobImagesPlan = this.createImagesPlan(config),
    scripts: GithubScriptFiles = new GithubScriptFiles(),
  ): Promise<Record<string, GithubWorkflow>> {
    const workflows: Record<string, GithubWorkflow> = {};

    // per-pipeline-type variables (pipelines.github.runnerVariables);
    // workflow-level env, so job-level runnerVariables take precedence
    const workflowEnv = {
      ...GITHUB_INJECTED_WORKFLOW_ENV,
      ...getPipelineOptions(config, this.type).runnerVariables,
    };

    const reviewStopJobs: Record<string, GithubJob> = {};
    // jobs routed to the per-kind workflow_dispatch workflows (deploy /
    // stop / rollback). A manual job and its build closure live there
    // instead of an automatic workflow; `conditions` is the `if` that
    // selects each one from the dispatch input, `options` the leaf jobs
    // that become dropdown choices (closure jobs run because their leaf
    // was chosen, not on their own). A closure job serving leaves of
    // several kinds is duplicated into each kind's workflow.
    const manualKindBuckets: Record<ManualKind, ManualKindBucket> = {
      deploy: { jobs: {}, conditions: {}, options: [], envTypes: [] },
      stop: { jobs: {}, conditions: {}, options: [], envTypes: [] },
      rollback: { jobs: {}, conditions: {}, options: [], envTypes: [] },
    };

    for (const trigger of ALL_PIPELINE_TRIGGERS) {
      const allJobs = await createAllJobs({
        config,
        trigger,
        pipelineType: this.type,
      });

      const uploadProviderIds = getUploadProviderIds(allJobs);
      const secretKinds = collectSecretKinds(allJobs);

      // build every job of the trigger up front: partitioning the manual
      // jobs needs the whole dependency graph.
      // NOTE: agent jobs are gitlab-only and skipped on github
      const triggerJobs = new Map<
        string,
        { githubJob: GithubJob; job: CatladderJob; context: Context }
      >();
      [...allJobs.workspaces, ...allJobs.components].forEach(
        ({ context, jobs: contextJobs }) =>
          contextJobs.forEach((job) => {
            const [id, githubJob] = makeGithubJob(
              context,
              job,
              allJobs,
              uploadProviderIds,
              images,
              scripts,
              secretKinds,
            );
            triggerJobs.set(id, { githubJob, job, context });
          }),
      );

      // review-stop jobs run in their own on:pull_request:closed workflow
      for (const [id, { githubJob, job, context }] of [...triggerJobs]) {
        if (isReviewStopJob(context, job)) {
          reviewStopJobs[id] = githubJob;
          triggerJobs.delete(id);
        }
      }

      // leaf manual jobs: an explicit manual gate (e.g. a prod deploy) or
      // a stop/rollback task with no automatic trigger. Each becomes a
      // dispatch choice.
      const leafIds = [...triggerJobs]
        .filter(([, { job }]) => job.gate === "manual" || isManualTaskJob(job))
        .map(([id]) => id);

      // A manual leaf drags its whole connected region into the manual
      // workflow, in both directions, so that a dispatch runs the complete
      // flow and nothing is left dangling in the automatic workflow:
      //  - upstream (jobs the leaf needs): github artifacts are scoped to
      //    a single run, so a dispatched job can't reuse the automatic
      //    run's build — it has to rebuild, so the build moves too.
      //  - downstream (jobs that need the leaf, e.g. a post-deploy verify):
      //    they can't run automatically once their prerequisite is manual.
      // Needs pointing outside the trigger (the global image-build jobs)
      // exist in every workflow and are left alone. Because catladder's
      // deploy/verify jobs are per env, a leaf's region stays within its
      // env and never swallows another env's automatic chain.
      // servesLeaves maps every moved job to the leaves that own it.
      const dependents = new Map<string, string[]>();
      for (const [id, { githubJob }] of triggerJobs) {
        for (const need of githubJob.needs ?? []) {
          if (!triggerJobs.has(need)) continue;
          const list = dependents.get(need);
          if (list) list.push(id);
          else dependents.set(need, [id]);
        }
      }
      const servesLeaves = new Map<string, Set<string>>();
      for (const leaf of leafIds) {
        const stack = [leaf];
        let cur: string | undefined;
        while ((cur = stack.pop()) !== undefined) {
          let leaves = servesLeaves.get(cur);
          if (leaves?.has(leaf)) continue; // already walked for this leaf
          if (!leaves) {
            leaves = new Set();
            servesLeaves.set(cur, leaves);
          }
          leaves.add(leaf);
          for (const need of triggerJobs.get(cur)?.githubJob.needs ?? []) {
            if (triggerJobs.has(need)) stack.push(need); // upstream deps
          }
          for (const dependent of dependents.get(cur) ?? []) {
            stack.push(dependent); // downstream consumers
          }
        }
      }

      const kindOfLeaf = new Map<string, ManualKind>(
        leafIds.map((id) => [id, manualKind(triggerJobs.get(id)!.job)]),
      );
      const jobs: Record<string, GithubJob> = {};
      for (const [id, { githubJob }] of triggerJobs) {
        const leaves = servesLeaves.get(id);
        if (leaves) {
          // one entry per kind the job serves — restricted to that
          // kind's leaves, so the `if` only references its own inputs
          for (const kind of new Set(
            [...leaves].map((leaf) => kindOfLeaf.get(leaf)!),
          )) {
            const bucket = manualKindBuckets[kind];
            bucket.jobs[id] = githubJob;
            bucket.conditions[id] = [...leaves]
              .filter((leaf) => kindOfLeaf.get(leaf) === kind)
              .sort()
              .map((leaf) => `inputs.job == '${leaf}'`)
              .join(" || ");
          }
        } else {
          jobs[id] = githubJob;
        }
      }
      for (const id of leafIds) {
        const bucket = manualKindBuckets[kindOfLeaf.get(id)!];
        bucket.options.push(id);
        const context = triggerJobs.get(id)!.context;
        if (context.type === "component") {
          bucket.envTypes.push(context.environment.envType);
        }
      }

      if (trigger === "mr") {
        Object.assign(jobs, getGithubReleaseCheckJobs(config, images));
      }

      if (trigger === "mainBranch") {
        // auto release mode: the release job runs at the end of the
        // main workflow itself
        Object.assign(
          jobs,
          getGithubReleaseJobs(config, Object.keys(jobs), images),
        );

        // the dispatch workflow to trigger a release by hand (with a
        // force checkbox where the method distinguishes it)
        workflows[`${GENERATED_FILE_PREFIX}create-release.yml`] =
          getGithubCreateReleaseWorkflow(config, images, workflowEnv);

        // manual release mode: the workflow that runs a queued release
        // once the main workflow completed green
        const releaseOnGreen = getGithubReleaseOnGreenWorkflow(
          config,
          images,
          TRIGGER_WORKFLOWS.mainBranch.name,
          workflowEnv,
        );
        if (releaseOnGreen) {
          workflows[`${GENERATED_FILE_PREFIX}release-on-green.yml`] =
            releaseOnGreen;
        }
      }

      if (Object.keys(jobs).length > 0) {
        workflows[`${GENERATED_FILE_PREFIX}${workflowFileName(trigger)}`] = {
          ...TRIGGER_WORKFLOWS[trigger],
          ...workflowPermissions(images),
          env: workflowEnv,
          jobs: { ...makeEnsureImageGithubJobs(images), ...jobs },
        };
      }
    }

    if (Object.keys(reviewStopJobs).length > 0) {
      workflows[`${GENERATED_FILE_PREFIX}review-stop.yml`] = {
        name: "🛑 catladder stop review app",
        on: {
          pull_request: { types: ["closed"] },
          // tearing a review app down while its pull request is still
          // open (gitlab offers this as a manual job in the MR
          // pipeline); the automatic teardown on close stays the
          // normal path
          workflow_dispatch: {
            inputs: {
              pr: {
                description:
                  "number of the pull request whose review app to stop",
                required: true,
                type: "string",
              },
            },
          },
        },
        ...workflowPermissions(images),
        env: {
          ...workflowEnv,
          // a dispatched run has no pull_request event to take the
          // number from — fall back to the input
          CL_PR_NUMBER: "${{ github.event.number || inputs.pr }}",
        },
        jobs: { ...makeEnsureImageGithubJobs(images), ...reviewStopJobs },
      };
    }

    for (const [kind, bucket] of Object.entries(manualKindBuckets) as Array<
      [ManualKind, ManualKindBucket]
    >) {
      if (Object.keys(bucket.jobs).length === 0) {
        continue;
      }
      const options = [...new Set(bucket.options)];
      // a single candidate needs no dropdown — the dispatch just runs it
      const singleTask = options.length === 1;
      // one common env across the kind's tasks → carry it in the name
      // ("▶️ catladder deploy prod"); mixed envs keep the generic name
      // and the dropdown distinguishes
      const envTypes = [...new Set(bucket.envTypes)];
      const envSuffix =
        envTypes.length === 1 &&
        bucket.envTypes.length === bucket.options.length
          ? ` ${envTypes[0]}`
          : "";
      workflows[`${GENERATED_FILE_PREFIX}${kind}.yml`] = {
        name: `${MANUAL_KIND_WORKFLOW_NAMES[kind]}${envSuffix}`,
        on: {
          workflow_dispatch: singleTask
            ? {}
            : {
                inputs: {
                  job: {
                    description: "the task to run",
                    required: true,
                    type: "choice",
                    options,
                  },
                },
              },
        },
        ...workflowPermissions(images),
        env: workflowEnv,
        jobs: {
          ...makeEnsureImageGithubJobs(images),
          ...Object.fromEntries(
            Object.entries(bucket.jobs).map(([id, job]) => [
              id,
              singleTask
                ? job
                : { ...job, if: `\${{ ${bucket.conditions[id]} }}` },
            ]),
          ),
        },
      };
    }

    return workflows;
  }
}

/**
 * job images are built and pushed to ghcr, which needs packages:write
 */
const workflowPermissions = (_images: JobImagesPlan) => ({
  permissions: { contents: "read", packages: "write" },
});

const workflowFileName = (trigger: PipelineTrigger): string => {
  switch (trigger) {
    case "mr":
      return "review.yml";
    case "mainBranch":
      return "main.yml";
    case "taggedRelease":
      return "release.yml";
  }
  throw new Error(`${trigger} is not supported`);
};

/**
 * stop jobs of review environments run in their own workflow when the
 * pull request is closed (the counterpart of gitlab's on_stop wiring)
 */
const isReviewStopJob = (context: Context, job: CatladderJob) =>
  job.environment?.action === "stop" &&
  context.type === "component" &&
  context.environment.envType === "review";

/**
 * stop/rollback jobs of non-review environments have no automatic
 * trigger; they are collected in workflow_dispatch workflows
 * (gitlab runs them as manual jobs inside the pipeline)
 */
const isManualTaskJob = (job: CatladderJob) =>
  job.stage === "stop" || job.stage === "rollback";

/**
 * manual tasks are split into one workflow_dispatch workflow per kind
 * of action, so each kind is its own entry in the Actions sidebar with
 * a homogeneous run history and a short same-kind dropdown (the emoji
 * prefixes make the triggerable workflows stand out from the pipeline
 * workflows)
 */
type ManualKind = "deploy" | "stop" | "rollback";

type ManualKindBucket = {
  jobs: Record<string, GithubJob>;
  conditions: Record<string, string>;
  options: string[];
  /**
   * env types of the kind's leaf tasks: when they all target one env,
   * the workflow name carries it (e.g. "▶️ catladder deploy prod")
   */
  envTypes: string[];
};

const MANUAL_KIND_WORKFLOW_NAMES: Record<ManualKind, string> = {
  deploy: "▶️ catladder deploy",
  stop: "🛑 catladder stop",
  rollback: "↩️ catladder rollback",
};

const manualKind = (job: CatladderJob): ManualKind =>
  job.stage === "stop"
    ? "stop"
    : job.stage === "rollback"
      ? "rollback"
      : "deploy";
