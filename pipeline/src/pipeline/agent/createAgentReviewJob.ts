import { RULE_IS_MERGE_REQUEST } from "../../rules";
import type { AgentContext, CatladderJob } from "../../types";
import { getMergeRequestPrompt } from "./prompts";
import { baseSetupScript, callClaude, createBaseAgentJob } from "./shared";
import { getAgentUserName } from "./utils";

export const createAgentReviewJob = (context: AgentContext): CatladderJob => {
  const baseJob = createBaseAgentJob(context);

  const agentUserName = getAgentUserName(context);
  return {
    ...baseJob,
    name: context.name + "-agent-review",

    rules: [
      {
        ...RULE_IS_MERGE_REQUEST,
        when: "always",
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
