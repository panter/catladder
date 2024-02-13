import type Vorpal from "vorpal";
import {
  evaluateSecurityAudit,
  makeSecurityAuditOverview,
} from "./evaluateSecurityAudit";
import { Gitlab } from "@gitbeaker/rest";
import {
  SECURITY_AUDIT_FILE_NAME,
  createSecurityAuditMergeRequest,
} from "./createSecurityAuditMergeRequest";

const GITLAB_HOST = "https://git.panter.ch";

export default function (vorpal: Vorpal) {
  commandCiJob(vorpal);
  commandEvaluate(vorpal);
  commandCreate(vorpal);
}

async function commandCiJob(vorpal: Vorpal) {
  vorpal
    .command(
      "security-audit-ci-job <path> <token> <mainBranch> <projectId> <userId>",
      `Evaluates security audit document. If the document can't be evaluated or does not exist, creates a new MR with security audit document template.

<path> root path of a project with security audit document (${SECURITY_AUDIT_FILE_NAME})
<token> gitlab token with 'api' scopes and permissions to create a new branch
<main-branch> main branch name
<project-id> project id to create security audit for
<user-id> gitlab user id that will be assignee of the audit
`
    )
    .action(async (args) => {
      const evaluation = await evaluateSecurityAudit({ path: args.path });

      if (evaluation.isErr()) {
        console.log("could not evaluate security audit document");
        console.log(
          "creating new merge request with security audit template..."
        );

        const { token, mainBranch, projectId, userId } = args;
        const api = new Gitlab({
          host: GITLAB_HOST,
          token,
        });

        const mr = await createSecurityAuditMergeRequest({
          api,
          mainBranch,
          projectId,
          userId: parseInt(userId),
        });

        if (mr.isErr()) {
          console.error(
            `could not create merge request with security audit template: ${mr.error}`
          );
          process.exitCode = 1;
          return;
        }

        console.log("security audit merge request created successfully");
        console.log(
          `please finish the MR by updating SECURITY.md document: ${mr.value.web_url}`
        );
        process.exitCode = 1;
        return;
      }

      if (evaluation.value.score.answeredTopics === 0) {
        console.error("audit document has no answered topics");
        console.error(
          `please answer security topics in ${SECURITY_AUDIT_FILE_NAME} by adding responsible people and check/cross in the table`
        );
        process.exitCode = 1;
        return;
      }

      process.exitCode = 0;
      console.log(makeSecurityAuditOverview(evaluation.value));
    });
}

async function commandEvaluate(vorpal: Vorpal) {
  vorpal
    .command(
      "security-audit-evaluate <path>",
      "Evaluates security audit document in given <path>"
    )
    .action(async (args) => {
      console.log("evaluating security audit document...");

      const result = await evaluateSecurityAudit({ path: args.path });
      if (result.isErr()) {
        console.error(result.error);
        console.error(
          `please make sure the security audit document ${SECURITY_AUDIT_FILE_NAME} is in the repository`
        );
        process.exitCode = 1;
      } else {
        console.log(makeSecurityAuditOverview(result.value));
      }
    });
}

async function commandCreate(vorpal: Vorpal) {
  vorpal
    .command(
      "security-audit-create <token> <mainBranch> <projectId> <userId>",
      `Creates a MR in given project with the latest security audit template document

<token> gitlab token with 'api' scopes and permissions to create a new branch
<main-branch> main branch name
<project-id> project id to create security audit for
<user-id> gitlab user id that will be assignee of the audit
`
    )
    .action(async (args) => {
      const { token, mainBranch, projectId, userId } = args;

      const api = new Gitlab({
        host: GITLAB_HOST,
        token,
      });

      const result = await createSecurityAuditMergeRequest({
        api,
        mainBranch,
        projectId,
        userId: parseInt(userId),
      });

      if (result.isErr()) {
        console.error(
          `could not create security audit merge request: ${result.error}`
        );
        process.exitCode = 1;
      } else {
        console.log("security audit merge request created successfully");
        console.log(
          `please finish the MR by updating SECURITY.md document: ${result.value.web_url}`
        );
      }
    });
}
