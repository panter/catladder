import type { AgentContext, CatladderJob } from "../../types";
import { getEventPrompt } from "./prompts";
import { baseSetupScript, callClaude, createBaseAgentJob } from "./shared";
import { getAgentUserId, getAgentUserName } from "./utils";

export const createAgentEventJob = (context: AgentContext): CatladderJob => {
  const baseJob = createBaseAgentJob(context);
  // unfortunatly, we need to manage both, because the "@mention"-feature only works with the username
  const agentUserId = getAgentUserId(context);
  const agentUserName = getAgentUserName(context);
  return {
    interruptible: false, // do not cancel this job if it is running. Otherwise a commit to main will cancel it
    ...baseJob,
    variables: {
      ...baseJob.variables,
    },
    name: context.name + "-agent-event",
    rules: [
      {
        if: `$CI_PIPELINE_SOURCE  == "trigger" && ($ASSIGNEE_USER_ID == ${agentUserId} || $OBJECT_DESCRIPTION =~ /@${agentUserName}/)`,
        when: "always",
      },

      {
        when: "never",
      },
    ],
    script: [
      ...baseSetupScript,
      ...callClaude({
        prompt: getEventPrompt({ agentUserName: agentUserName }),
      }),
    ],
  };
};
