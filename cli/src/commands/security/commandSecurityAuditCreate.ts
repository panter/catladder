import { defineCommand } from "../../core/defineCommand";
import { Gitlab } from "@gitbeaker/rest";
import { createSecurityAuditMergeRequest } from "../../apps/catci/commands/security/createSecurityAuditMergeRequest";

const GITLAB_HOST = "https://git.panter.ch";

export const commandSecurityAuditCreate = defineCommand({
  name: "security-audit-create",
  description: "Creates a MR with the latest security audit template document",
  group: "security",
  inputs: {
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
    const token = await ctx.get("token");
    const mainBranch = await ctx.get("mainBranch");
    const projectId = await ctx.get("projectId");
    const userId = await ctx.get("userId");

    const api = new Gitlab({ host: GITLAB_HOST, token });

    const result = await createSecurityAuditMergeRequest({
      api,
      mainBranch,
      projectId,
      userId: parseInt(userId),
    });

    if (result.isErr()) {
      ctx.log(`could not create security audit merge request: ${result.error}`);
      process.exitCode = 1;
    } else {
      ctx.log("security audit merge request created successfully");
      ctx.log(
        `please finish the MR by updating SECURITY.md document: ${result.value.web_url}`,
      );
    }
  },
});
