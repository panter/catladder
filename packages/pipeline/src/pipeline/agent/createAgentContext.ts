import type { Config } from "../../types";

export class AgentContext {
  constructor(
    private readonly agentName: string,
    private readonly config: Config,
  ) {}

  public readonly type = "agent";

  get name() {
    return this.agentName;
  }

  get agentConfig() {
    const agentConfig = this.config.agents?.[this.agentName];
    if (!agentConfig) {
      throw new Error(`Agent ${this.agentName} not found in config`);
    }
    return agentConfig;
  }

  get agentUser() {
    return {
      username: this.agentConfig.agentUser?.username ?? "agent.claude",
      userId: this.agentConfig.agentUser?.userId ?? "$DEFAULT_AGENT_USER_ID",
    };
  }

  get reviews() {
    return {
      byUser: this.agentConfig.reviews?.byUser ?? {
        [this.agentUser.username]: { automatic: true },
      },
    };
  }

  get fullConfig() {
    return this.config;
  }
}

export const createAgentContext = async (ctx: {
  agentName: string;
  config: Config;
}) => {
  return new AgentContext(ctx.agentName, ctx.config);
};
