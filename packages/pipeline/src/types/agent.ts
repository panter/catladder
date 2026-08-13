export type AgentConfig = {
  type: "claude";
  agentUser?: {
    username: string;
    userId: string;
  };
  reviews?: {
    /**
     * usernames that the agent should review merge requests for.
     * Defaults to agentUser
     */
    byUser?:
      | Record<
          string,
          {
            automatic: boolean;
          }
        >
      | "all-automatic";
  };
};
