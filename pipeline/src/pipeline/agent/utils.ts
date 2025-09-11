import type { AgentContext } from "../../types";

export const getAgentUserName = (context: AgentContext) => {
  return context.agentConfig.agentUser?.username ?? "agent.claude";
};

export const getAgentUserId = (context: AgentContext) => {
  return context.agentConfig.agentUser?.userId ?? "$DEFAULT_AGENT_USER_ID";
};
