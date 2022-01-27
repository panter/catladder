import { Retry } from "../types";

export const BASE_RETRY: Retry = {
  max: 2,
  when: ["runner_system_failure", "stuck_or_timeout_failure"],
};
