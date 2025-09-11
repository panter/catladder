import type { AgentContext } from "../../types";
import { createAgentEventJob } from "./createAgentEventJob";
import { createAgentReviewJob } from "./createAgentReviewJob";

export const createJobsForAgentContext = (context: AgentContext) => {
  return [createAgentEventJob(context), createAgentReviewJob(context)];
};
