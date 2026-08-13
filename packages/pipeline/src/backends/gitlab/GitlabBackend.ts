import { readFile, rm } from "fs/promises";
import {
  RULE_IS_MAIN_BRANCH_AND_NOT_RELEASE_COMMIT,
  RULE_IS_MERGE_REQUEST,
  RULE_IS_TAGGED_RELEASE,
  RULE_NEVER_ON_AGENT_TRIGGER,
} from "../../rules";
import type {
  ComponentContext,
  Config,
  GitlabJobDef,
  GitlabRule,
  Pipeline,
  PipelineTrigger,
  WorkspaceContext,
} from "../../types";
import { ALL_PIPELINE_TRIGGERS } from "../../types/config";
import { createAllJobs } from "../../pipeline/createAllJobs";
import { JobImagesPlan } from "../../customImages/jobImagesPlan";
import { getCatciGeneratedFiles } from "../../catci/shippedCatci";
import { getReleaseMethod } from "../../release";
import type { PipelineBackend, PipelineFile } from "../types";
import { getPipelineOptions } from "../index";
import type { GitlabJobWithContext } from "./createGitlabJobs";
import { createGitlabJobs } from "./createGitlabJobs";
import { createGitlabPipelineWithDefaults } from "./createGitlabPipeline";
import { getGitlabReleaseJobs } from "./gitlabReleaseJobs";
import { getPipelineStages } from "./getPipelineStages";
import { getReleaseGateJobNames } from "./releaseGateJobs";
import { sortGitLabJobDefProps } from "./sortGitLabJobDefProps";
import { GENERATED_FILE_MARKER } from "../../utils/writeFiles";

const CATLADDER_GENERATED_FOLDER = ".catladder-generated";

const GITLAB_GENERATED_FOLDER = CATLADDER_GENERATED_FOLDER + "/gitlab";

const GITLAB_MAIN_FILE = ".gitlab-ci.yml";

export class GitlabBackend implements PipelineBackend {
  readonly type = "gitlab" as const;

  readonly generatedFolder = GITLAB_GENERATED_FOLDER;

  async cleanup() {
    await rm(this.generatedFolder, { force: true, recursive: true });
    // `.gitlab-ci.yml` lives outside the generated folder, so it used to
    // survive disabling the gitlab backend and kept a stale pipeline
    // running. Only remove it when it is ours: a project that generates
    // github only may well hand-maintain a gitlab file of its own.
    const mainFile = await readFile(GITLAB_MAIN_FILE, "utf-8").catch(
      () => null,
    );
    if (mainFile?.includes(GENERATED_FILE_MARKER)) {
      await rm(GITLAB_MAIN_FILE, { force: true });
    }
  }

  async createFiles(config: Config): Promise<PipelineFile[]> {
    const images = this.createImagesPlan(config);
    const includes = await this.createIncludes(config, images);

    const mainFile: PipelineFile = {
      path: GITLAB_MAIN_FILE,
      content: {
        include: includes.map((i) => i.path),
      },
    };

    return [
      mainFile,
      ...includes,
      // materialized image definitions (repo mode)
      ...images.getGeneratedFiles(),
      // catci: the CI companion the release job's security audit runs
      ...getCatciGeneratedFiles(),
    ];
  }

  private createImagesPlan(config: Config): JobImagesPlan {
    return new JobImagesPlan(this.type, config.images);
  }

  /**
   * the complete pipeline as one object (all includes merged into one),
   * mainly for testing purposes
   */
  async createCompletePipeline(
    config: Config,
  ): Promise<Record<string, unknown>> {
    const includes = await this.createIncludes(
      config,
      this.createImagesPlan(config),
    );

    return includes.reduce((acc, { content }) => {
      return {
        ...acc,
        // includes are always yaml objects
        ...(content as Record<string, unknown>), // merge all includes into one object
      };
    }, {});
  }

  private async createIncludes(
    config: Config,
    images: JobImagesPlan,
  ): Promise<PipelineFile[]> {
    const { jobs, image, stages, variables, workflow, ...pipelineRest } =
      await this.createPipeline(config, images);
    // we will create 1 include per component or workspace
    // this is for better readability in git diffs and to avoid problems with yaml files beeing too large
    // group by context
    const groups = Object.entries(jobs).reduce(
      (acc, [jobName, { gitlabJob, context }]) => {
        const group = !context
          ? "global-jobs"
          : context?.type + "/" + context.name;
        if (!acc[group]) {
          acc[group] = {};
        }

        acc[group][jobName] = sortGitLabJobDefProps(gitlabJob); // also sort properties for more consistent diffing
        return acc;
      },
      {} as Record<string, Record<string, GitlabJobDef>>,
    );

    const componentIncludes = Object.entries(groups).map(([group, jobs]) => {
      return {
        path: GITLAB_GENERATED_FOLDER + "/" + group + ".yaml",
        content: jobs,
      };
    });

    const mainInclude: PipelineFile = {
      path: GITLAB_GENERATED_FOLDER + "/main.yaml",
      content: {
        image,
        stages,
        variables,
        workflow,
        ...pipelineRest,
      },
    };

    return [mainInclude, ...componentIncludes];
  }

  private async createPipeline(
    config: Config,
    images: JobImagesPlan,
  ): Promise<Pipeline<"gitlab">> {
    const stages = getPipelineStages(config);

    // register the release image first: the per-trigger job creation
    // below emits the build jobs of all images registered so far. The
    // release jobs themselves are created afterwards — they need the
    // main-branch job list for the queued-release executor's needs.
    images.resolveRef({ catladderImage: getReleaseMethod(config).image });

    // for all triggers create jobs and add base rules
    const jobsPerTrigger = await Promise.all(
      ALL_PIPELINE_TRIGGERS.map(async (trigger) => ({
        trigger,
        jobs: await createGitlabJobs(
          await createAllJobs({ config, trigger, pipelineType: this.type }),
          images,
          getGitlabRulesForTrigger(trigger),
        ),
      })),
    );
    const allJobsPerTrigger = jobsPerTrigger.flatMap(({ jobs }) => jobs);

    // the jobs the queued-release executor waits for: everything that
    // runs automatically in a main-branch pipeline. Manual jobs (stop,
    // rollback, gates) are excluded — gitlab skips a job whose needs
    // include an unplayed manual job.
    const mainBranchAutoJobs = jobsPerTrigger
      .filter(({ trigger }) => trigger === "mainBranch")
      .flatMap(({ jobs }) => jobs)
      .filter(({ gitlabJob }) => !isManualGitlabJob(gitlabJob));

    // only the sinks of the auto-job graph — every other auto job is
    // awaited transitively through them (see releaseGateJobs.ts)
    const mainBranchJobNames = getReleaseGateJobNames(mainBranchAutoJobs);

    const releaseJobs = getGitlabReleaseJobs(
      config,
      images,
      mainBranchJobNames,
    );

    const allWorkspaceJobs = allJobsPerTrigger
      .filter((j) => j.context?.type === "workspace") // sort by componentName in the same order as they appear in the config
      // this is purely for better readability in git diffs when you add new components
      .sort((a, b) => {
        const workspaceNames = Object.keys(config.builds ?? {});
        const aIndex = workspaceNames.findIndex(
          (c) => c === (a.context as WorkspaceContext).name,
        );
        const bIndex = workspaceNames.findIndex(
          (c) => c === (b.context as WorkspaceContext).name,
        );
        return aIndex - bIndex;
      });

    const allComponentJobs = allJobsPerTrigger
      .filter((j) => j.context?.type === "component")
      // sort by componentName in the same order as they appear in the config
      // this is purely for better readability in git diffs when you add new components
      .sort((a, b) => {
        const componentNames = Object.keys(config.components);
        const aIndex = componentNames.findIndex(
          (c) => c === (a.context as ComponentContext).name,
        );
        const bIndex = componentNames.findIndex(
          (c) => c === (b.context as ComponentContext).name,
        );
        return aIndex - bIndex;
      });

    const allGlobalJobs = allJobsPerTrigger.filter(
      (j) => j.context?.type === "agent",
    );

    // context-less jobs (image build jobs)
    const allContextlessJobs = allJobsPerTrigger.filter(
      (j) => j.context === null,
    );

    const allJobs = [
      ...allContextlessJobs,
      ...allWorkspaceJobs,
      ...allComponentJobs,
      ...allGlobalJobs,
    ].reduce(
      (acc, { gitlabJob, name, context }) => {
        // merge jobs, if a job is already there, merge the rules
        // this is currently needed because of envMode: "none", which creates the same job for all triggers, so it can appear multiple times
        // NOTICE: envNode none has been removed and this may no longer be needed
        if (acc[name]) {
          acc[name].gitlabJob.rules = [
            ...(acc[name].gitlabJob.rules ?? []),
            ...(gitlabJob.rules ?? []),
          ];
        } else {
          acc[name] = { context, gitlabJob };
        }

        return acc;
      },
      {} as { [key: string]: GitlabJobWithContext },
    );

    return createGitlabPipelineWithDefaults({
      stages: [...stages, "release"],
      jobs: {
        ...allJobs,
        ...Object.fromEntries(
          Object.entries(releaseJobs).map(([name, gitlabJob]) => [
            name,
            {
              gitlabJob,
              context: null,
            },
          ]),
        ),
      },
      variables: {
        ...config.runnerVariables,
        // per-pipeline-type variables (pipelines.gitlab.runnerVariables)
        ...getPipelineOptions(config, this.type).runnerVariables,
      },
    });
  }
}

/**
 * whether a job can end up waiting for a human in a main-branch
 * pipeline (catladder expresses manual-ness only through rules)
 */
function isManualGitlabJob(job: GitlabJobDef): boolean {
  return (job.rules ?? []).some((rule) => rule.when === "manual");
}

function getGitlabRulesForTrigger(trigger: PipelineTrigger): GitlabRule[] {
  // mainBranch: on push to main branch except it's a release commit
  // mr: on merge request
  // taggedRelease: on tag
  switch (trigger) {
    case "mainBranch":
      return [
        RULE_NEVER_ON_AGENT_TRIGGER,
        RULE_IS_MAIN_BRANCH_AND_NOT_RELEASE_COMMIT,
      ];
    case "mr":
      return [RULE_NEVER_ON_AGENT_TRIGGER, RULE_IS_MERGE_REQUEST];
    case "taggedRelease":
      return [RULE_NEVER_ON_AGENT_TRIGGER, RULE_IS_TAGGED_RELEASE];
  }

  throw new Error(`${trigger} is not supported`);
}
