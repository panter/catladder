import type { AgentContext } from "../../types";
import { getEventPrompt } from "./prompts";
import { AgentJob, baseSetupScript, callClaude } from "./shared";
import { getAgentUserId, getAgentUserName } from "./utils";

export class AgentEventJob extends AgentJob {
  constructor(context: AgentContext) {
    // unfortunatly, we need to manage both, because the "@mention"-feature only works with the username
    const agentUserId = getAgentUserId(context);
    const agentUserName = getAgentUserName(context);
    super(context, {
      interruptible: false, // do not cancel this job if it is running. Otherwise a commit to main will cancel it
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
    });
  }
}
