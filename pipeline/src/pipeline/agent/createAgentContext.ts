import type { Config } from "../../types";
import type { AgentContext } from "../../types/context";

export const createAgentContext = async (ctx: {
  agentName: string;
  config: Config;
}): Promise<AgentContext> => {
  const agentConfig = ctx.config.agents?.[ctx.agentName];
  if (!agentConfig) {
    throw new Error(`Agent ${ctx.agentName} not found in config`);
  }
  return {
    type: "agent",
    name: ctx.agentName,
    //env: ctx.env,
    fullConfig: ctx.config,
    agentConfig: agentConfig,
  };
};
