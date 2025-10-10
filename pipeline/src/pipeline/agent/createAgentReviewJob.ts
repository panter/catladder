import { RULE_IS_MERGE_REQUEST } from "../../rules";
import type { AgentContext, CatladderJob, GitlabRule } from "../../types";
import { getMergeRequestPrompt } from "./prompts";
import { baseSetupScript, callClaude, createBaseAgentJob } from "./shared";
import { getAgentUserName } from "./utils";

export const createAgentReviewJob = (context: AgentContext): CatladderJob => {
  const baseJob = createBaseAgentJob(context);

  const agentUserName = getAgentUserName(context);

  const rules: GitlabRule[] =
    context.reviews.byUser === "all-automatic"
      ? [
          {
            ...RULE_IS_MERGE_REQUEST,
            when: "always",
          },
        ]
      : Object.entries(context.reviews.byUser)
          .filter(([_, { automatic }]) => automatic)
          .map(([username]) => ({
            // GITLAB_USER_LOGIN is the username of the user who created the pipeline
            if: `${RULE_IS_MERGE_REQUEST.if} && $GITLAB_USER_LOGIN == "${username}"`,
            when: "always",
          }));

  return {
    ...baseJob,
    envMode: "jobPerEnv",
    name: context.name + "-agent-review",
    allow_failure: true, // make it optional
    rules: [
      ...rules,
      {
        ...RULE_IS_MERGE_REQUEST,
        when: "manual",
      },
      {
        when: "never",
      },
    ],
    script: [
      ...baseSetupScript,
      ...callClaude({
        prompt: getMergeRequestPrompt({
          agentUserName: agentUserName,
        }),
      }),
    ],
  };
};
