import { defineCommand } from "../../core/defineCommand";
import {
  evaluateSecurityAudit,
  makeSecurityAuditOverview,
} from "../../security/evaluateSecurityAudit";
import { getGitRoot } from "../../utils/projects";

export const commandSecurityEvaluate = defineCommand({
  name: "project-security-evaluate",
  description: "evaluate project's security audit document",
  group: "project",
  inputs: {},
  execute: async (ctx) => {
    const gitRoot = await getGitRoot();
    const result = await evaluateSecurityAudit({ path: gitRoot });
    if (result.isErr()) {
      ctx.log(`Could not evaluate security audit document: ${result.error}`);
    } else {
      ctx.log(makeSecurityAuditOverview(result.value));
    }
  },
});
