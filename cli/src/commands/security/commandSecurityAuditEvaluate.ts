import { defineCommand } from "../../core/defineCommand";
import {
  evaluateSecurityAudit,
  makeSecurityAuditOverview,
} from "../../apps/catci/commands/security/evaluateSecurityAudit";
import { SECURITY_AUDIT_FILE_NAME } from "../../apps/catci/commands/security/createSecurityAuditMergeRequest";

export const commandSecurityAuditEvaluate = defineCommand({
  name: "security-audit-evaluate",
  description: "Evaluates security audit document in given path",
  group: "security",
  inputs: {
    path: { type: "string", message: "path to project root", positional: true },
  },
  execute: async (ctx) => {
    const path = await ctx.get("path");
    ctx.log("evaluating security audit document...");

    const result = await evaluateSecurityAudit({ path });
    if (result.isErr()) {
      ctx.log(`${result.error}`);
      ctx.log(
        `please make sure the security audit document ${SECURITY_AUDIT_FILE_NAME} is in the repository`,
      );
      process.exitCode = 1;
    } else {
      ctx.log(makeSecurityAuditOverview(result.value));
    }
  },
});
