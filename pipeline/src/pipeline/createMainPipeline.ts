import {
  RULE_IS_MAIN_BRANCH_AND_NOT_RELEASE_COMMIT,
  RULE_IS_MERGE_REQUEST,
  RULE_IS_TAGGED_RELEASE,
  RULE_NEVER_ON_AGENT_TRIGGER,
} from "../rules";
import type {
  ComponentContext,
  GitlabRule,
  Pipeline,
  PipelineTrigger,
  PipelineType,
  WorkspaceContext,
} from "../types";
import { ALL_PIPELINE_TRIGGERS, type Config } from "../types/config";
import { createAllJobs } from "./createAllJobs";
import { getPipelineStages } from "./getPipelineStages";
import type { GitlabJobWithContext } from "./gitlab/createGitlabJobs";
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
    ).then((j) => j.flat());

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

    const allJobs = [
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
          Object.entries(getGitlabReleaseJobs(config)).map(
            ([name, gitlabJob]) => [
              name,
              {
                gitlabJob,
                context: null,
              },
            ],
          ),
        ),
      },
      variables: config.runnerVariables,
    }) as Pipeline<T>;
  }
  throw new Error(`${pipelineType} is not supported`);
};
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
