import { defineCommand } from "../../core/defineCommand";
import { Gitlab } from "@gitbeaker/rest";
import {
  evaluateSecurityAudit,
  makeSecurityAuditOverview,
} from "../../security/evaluateSecurityAudit";
import {
  createSecurityAuditMergeRequest,
  SECURITY_AUDIT_FILE_NAME,
} from "../../security/createSecurityAuditMergeRequest";
import { getGitlabHostUrl } from "../../utils/gitlabHost";

export const commandSecurityAuditCiJob = defineCommand({
  name: "security audit ci-job",
  description:
    "Evaluates security audit document. Creates MR with template if missing.",
  group: "security",
  inputs: {
    path: { type: "string", message: "path to project root", positional: true },
    token: {
      type: "string",
      message: "GitLab token (api scope)",
      positional: true,
    },
    mainBranch: {
      type: "string",
      message: "main branch name",
      positional: true,
    },
    projectId: {
      type: "string",
      message: "GitLab project ID",
      positional: true,
    },
    userId: {
      type: "string",
      message: "GitLab user ID (assignee)",
      positional: true,
    },
  },
  execute: async (ctx) => {
    const path = await ctx.get("path");
    const evaluation = await evaluateSecurityAudit({ path });

    if (evaluation.isErr()) {
      ctx.log("could not evaluate security audit document");
      ctx.log("creating new merge request with security audit template...");

      const token = await ctx.get("token");
      const mainBranch = await ctx.get("mainBranch");
      const projectId = await ctx.get("projectId");
      const userId = await ctx.get("userId");

      const api = new Gitlab({ host: await getGitlabHostUrl(), token });

      const mr = await createSecurityAuditMergeRequest({
        api,
        mainBranch,
        projectId,
        userId: parseInt(userId),
      });

      if (mr.isErr()) {
        ctx.log(
          `could not create merge request with security audit template: ${mr.error}`,
        );
        process.exitCode = 1;
        return;
      }

      ctx.log("security audit merge request created successfully");
      ctx.log(
        `please finish the MR by updating SECURITY.md document: ${mr.value.web_url}`,
      );
      process.exitCode = 1;
      return;
    }

    if (evaluation.value.score.answeredTopics === 0) {
      ctx.log("audit document has no answered topics");
      ctx.log(
        `please answer security topics in ${SECURITY_AUDIT_FILE_NAME} by adding responsible people and check/cross in the table`,
      );
      process.exitCode = 1;
      return;
    }

    ctx.log(makeSecurityAuditOverview(evaluation.value));
  },
});
