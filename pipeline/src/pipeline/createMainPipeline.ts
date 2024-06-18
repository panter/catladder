import {
  RULE_IS_MAIN_BRANCH,
  RULE_IS_MERGE_REQUEST,
  RULE_IS_TAGGED_RELEASE,
  RULE_NEVER_ON_RELEASE_COMMIT,
} from "../rules";
import type {
  GitlabJobDef,
  GitlabRule,
  Pipeline,
  PipelineTrigger,
  PipelineType,
} from "../types";
import { ALL_PIPELINE_TRIGGERS, type Config } from "../types/config";
import { createAllJobs } from "./createAllJobs";
import { getPipelineStages } from "./getPipelineStages";
import { createGitlabJobs } from "./gitlab/createGitlabJobs";
import { createGitlabPipelineWithDefaults } from "./gitlab/createGitlabPipeline";
import { getGitlabReleaseJobs } from "./gitlab/gitlabReleaseJobs";

export const createMainPipeline = async <T extends PipelineType>(
  pipelineType: T,
  config: Config,
): Promise<Pipeline<T>> => {
  const stages = getPipelineStages(config);

  if (pipelineType === "gitlab") {
    // for all triggers create jobs and add base rules

    const allJobsPerTrigger = await Promise.all(
      ALL_PIPELINE_TRIGGERS.map(
        async (trigger) =>
          await createGitlabJobs(
            await createAllJobs({ config, trigger, pipelineType }),
            getGitlabRulesForTrigger(trigger),
          ),
      ),
    );

    const allJobs = allJobsPerTrigger
      .flat()
      // sort by componentName in the same order as they appear in the config
      // this is purely for better readability in git diffs when you add new components
      .sort((a, b) => {
        const componentNames = Object.keys(config.components);
        const aIndex = componentNames.findIndex(
          (c) => c === a.context.componentName,
        );
        const bIndex = componentNames.findIndex(
          (c) => c === b.context.componentName,
        );
        return aIndex - bIndex;
      })

      .reduce(
        (acc, { gitlabJob, name }) => {
          // merge jobs, if a job is already there, merge the rules
          // this is currently needed because of envMode: "none", which creates the same job for all triggers, so it can appear multiple times
          if (acc[name]) {
            acc[name].rules = [
              ...(acc[name].rules ?? []),
              ...(gitlabJob.rules ?? []),
            ];
          } else {
            acc[name] = gitlabJob;
          }

          return acc;
        },
        {} as { [key: string]: GitlabJobDef },
      );

    return createGitlabPipelineWithDefaults({
      stages: [...stages, "release"],
      jobs: {
        ...allJobs,
        ...getGitlabReleaseJobs(),
      },
    }) as Pipeline<T>;
  }
  throw new Error(`${pipelineType} is not supported`);
};
function getGitlabRulesForTrigger(trigger: PipelineTrigger): GitlabRule[] {
  // mainBranch: on push to main branch
  // mr: on merge request
  // taggedRelease: on tag
  switch (trigger) {
    case "mainBranch":
      return [RULE_NEVER_ON_RELEASE_COMMIT, RULE_IS_MAIN_BRANCH];
    case "mr":
      return [RULE_IS_MERGE_REQUEST];
    case "taggedRelease":
      return [RULE_IS_TAGGED_RELEASE];
  }
}
