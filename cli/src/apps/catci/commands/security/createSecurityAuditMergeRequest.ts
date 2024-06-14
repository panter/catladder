import type { Gitlab } from "@gitbeaker/core";
import { Err, Result } from "ts-results-es";
import { makeTemplate } from "./auditDocument";

function makeDatedBranchName(branchName: string) {
  const date = new Date().toISOString().slice(0, -5).replaceAll(/[:.T]/g, "-");
  return `${branchName}-${date}`;
}

const MR_TITLE = "Draft: chore(security): add security audit document";
export const SECURITY_AUDIT_FILE_NAME = "SECURITY.md" as const;

export async function createSecurityAuditMergeRequest({
  projectId,
  mainBranch,
  userId,
  api,
}: {
  projectId: string;
  mainBranch: string;
  userId: number;
  api: Gitlab;
}) {
  const mrs = (
    await Result.wrapAsync(() =>
      api.MergeRequests.all({
        state: "opened",
        wip: "yes",
        labels: "security-audit",
      }),
    )
  ).mapErr(() => `could not search for existing merge requests` as const);
  if (mrs.isErr()) return mrs;

  const existingMr = mrs.value[0];
  if (existingMr)
    return Err(
      `open merge request with security audit already exists: ${existingMr.web_url}`,
    );

  const auditTemplate = Result.wrap(() => makeTemplate()).mapErr(
    () => "could not make security audit template document" as const,
  );
  if (auditTemplate.isErr()) return auditTemplate;

  const branch = (
    await Result.wrapAsync(() =>
      api.Branches.create(
        projectId,
        makeDatedBranchName("chore/security-audit"),
        mainBranch,
      ),
    )
  ).mapErr((e) => {
    console.log(e);
    return "could not create branch" as const;
  });
  if (branch.isErr()) return branch;

  const commit = (
    await Result.wrapAsync(() =>
      api.Commits.create(
        projectId,
        branch.value.name,
        "chore(security): add empty security audit document template",
        [
          {
            action: "create",
            filePath: SECURITY_AUDIT_FILE_NAME,
            content: auditTemplate.value,
            encoding: "text",
          },
        ],
      ),
    )
  ).mapErr(() => "could not create commit" as const);
  if (commit.isErr()) return commit;

  const mr = (
    await Result.wrapAsync(() =>
      api.MergeRequests.create(
        projectId,
        branch.value.name,
        mainBranch,
        MR_TITLE,
        {
          description: `Please follow and update security audit document in \`${SECURITY_AUDIT_FILE_NAME}\`.`,
          assigneeId: userId,
          squash: true,
          labels: "security-audit",
          removeSourceBranch: true,
        },
      ),
    )
  ).mapErr(() => "could not create merge request" as const);

  return mr;
}
