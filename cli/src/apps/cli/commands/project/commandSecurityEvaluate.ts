import type Vorpal from "vorpal";
import {
  evaluateSecurityAudit,
  makeSecurityAuditOverview,
} from "../../../catci/commands/security/evaluateSecurityAudit";
import { getGitRoot } from "../../../../utils/projects";

export default async (vorpal: Vorpal) => {
  vorpal
    .command(
      "project-security-evaluate",
      "evaluate project's security audit document"
    )
    .action(async function () {
      const gitRoot = await getGitRoot();
      const result = await evaluateSecurityAudit({ path: gitRoot });
      if (result.isErr()) {
        console.error(
          "Could not evaluate security audit document:",
          result.error
        );
      } else {
        console.log(makeSecurityAuditOverview(result.value));
      }
    });
};
