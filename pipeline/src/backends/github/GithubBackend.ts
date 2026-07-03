import { readdir, unlink } from "fs/promises";
import { join } from "path";
import { createAllJobs } from "../../pipeline/createAllJobs";
import type { Config, Context, PipelineTrigger } from "../../types";
import { ALL_PIPELINE_TRIGGERS } from "../../types/config";
import type { GithubJob, GithubWorkflow } from "../../types/github-types";
import type { CatladderJob } from "../../types/jobs";
import type { PipelineBackend, PipelineFile } from "../types";
import { GITHUB_INJECTED_WORKFLOW_ENV } from "./ciVariables";
import { getUploadProviderIds, makeGithubJob } from "./createGithubJobs";
import { getGithubReleaseJobs } from "./githubReleaseJobs";

const WORKFLOWS_FOLDER = ".github/workflows";

/**
 * generated workflow files are prefixed so that cleanup never touches
 * user-maintained workflows in the same folder
 */
const GENERATED_FILE_PREFIX = "catladder-";

const TRIGGER_WORKFLOWS: Record<
  PipelineTrigger,
  Pick<GithubWorkflow, "name" | "on" | "concurrency">
> = {
  mr: {
    name: "catladder review",
    on: { pull_request: { types: ["opened", "synchronize", "reopened"] } },
    concurrency: {
      group: "catladder-review-${{ github.event.number }}",
      "cancel-in-progress": true,
    },
  },
  mainBranch: {
    name: "catladder main",
    // TODO: make the default branch configurable
    on: { push: { branches: ["main"] } },
  },
  taggedRelease: {
    name: "catladder release",
    on: { push: { tags: ["v*"] } },
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
  }

  async createFiles(config: Config): Promise<PipelineFile[]> {
    const workflows = await this.createWorkflows(config);

    return Object.entries(workflows).map(([fileName, workflow]) => ({
      path: join(WORKFLOWS_FOLDER, fileName),
      content: workflow as unknown as Record<string, unknown>,
    }));
  }

  /**
   * all workflows keyed by file name, mainly for testing purposes
   */
  async createWorkflows(
    config: Config,
  ): Promise<Record<string, GithubWorkflow>> {
    const workflows: Record<string, GithubWorkflow> = {};

    const reviewStopJobs: Record<string, GithubJob> = {};
    const manualJobs: Record<string, GithubJob> = {};

    for (const trigger of ALL_PIPELINE_TRIGGERS) {
      const allJobs = await createAllJobs({
        config,
        trigger,
        pipelineType: this.type,
      });

      const uploadProviderIds = getUploadProviderIds(allJobs);
      const jobs: Record<string, GithubJob> = {};

      // NOTE: agent jobs are gitlab-only and skipped on github
      [...allJobs.workspaces, ...allJobs.components].forEach(
        ({ context, jobs: contextJobs }) =>
          contextJobs.forEach((job) => {
            const [id, githubJob] = makeGithubJob(
              context,
              job,
              allJobs,
              uploadProviderIds,
            );
            if (isReviewStopJob(context, job)) {
              reviewStopJobs[id] = githubJob;
            } else if (isManualTaskJob(job)) {
              manualJobs[id] = githubJob;
            } else {
              jobs[id] = githubJob;
            }
          }),
      );

      if (trigger === "mainBranch") {
        const releaseJobs = getGithubReleaseJobs(config, Object.keys(jobs));
        Object.assign(jobs, releaseJobs.main);
        Object.assign(manualJobs, releaseJobs.manual);
      }

      if (Object.keys(jobs).length > 0) {
        workflows[`${GENERATED_FILE_PREFIX}${workflowFileName(trigger)}`] = {
          ...TRIGGER_WORKFLOWS[trigger],
          env: GITHUB_INJECTED_WORKFLOW_ENV,
          jobs,
        };
      }
    }

    if (Object.keys(reviewStopJobs).length > 0) {
      workflows[`${GENERATED_FILE_PREFIX}review-stop.yml`] = {
        name: "catladder review stop",
        on: { pull_request: { types: ["closed"] } },
        env: GITHUB_INJECTED_WORKFLOW_ENV,
        jobs: reviewStopJobs,
      };
    }

    if (Object.keys(manualJobs).length > 0) {
      workflows[`${GENERATED_FILE_PREFIX}manual.yml`] = {
        name: "catladder manual tasks",
        on: {
          workflow_dispatch: {
            inputs: {
              job: {
                description: "the task to run",
                required: true,
                type: "choice",
                options: Object.keys(manualJobs),
              },
            },
          },
        },
        env: GITHUB_INJECTED_WORKFLOW_ENV,
        jobs: Object.fromEntries(
          Object.entries(manualJobs).map(([id, job]) => [
            id,
            { ...job, if: `\${{ inputs.job == '${id}' }}` },
          ]),
        ),
      };
    }

    return workflows;
  }
}

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
 * trigger; they are collected in a workflow_dispatch workflow
 * (gitlab runs them as manual jobs inside the pipeline)
 */
const isManualTaskJob = (job: CatladderJob) =>
  job.stage === "stop" || job.stage === "rollback";
