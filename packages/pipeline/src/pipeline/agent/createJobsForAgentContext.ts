import type { AgentContext } from "../../types";
import { AgentEventJob } from "./createAgentEventJob";
import { AgentReviewJob } from "./createAgentReviewJob";

export const createJobsForAgentContext = (context: AgentContext) => {
  return [new AgentEventJob(context), new AgentReviewJob(context)];
};
