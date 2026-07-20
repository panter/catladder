/**
 * catci — catladder's CI companion.
 *
 * A minimal, treeshaken bundle of the CLI commands that CI jobs need.
 * It is materialized into `.catladder-generated/catci/` by pipeline
 * generation, so jobs can run it with plain `node` — always the exact
 * version that generated the pipeline, with no install step and no
 * catladder baked into job images.
 *
 * Deliberately no CLI framework: the surface is tiny and the callers
 * are generated scripts, not humans.
 */
import { Gitlab } from "@gitbeaker/rest";
import {
  evaluateSecurityAudit,
  makeSecurityAuditOverview,
} from "./security/evaluateSecurityAudit";
import {
  createSecurityAuditMergeRequest,
  SECURITY_AUDIT_FILE_NAME,
} from "./security/createSecurityAuditMergeRequest";
import {
  changesetsReleaseJob,
  dispatchTaggedReleaseWorkflow,
} from "./release/changesetsReleaseJob";

const GITLAB_HOST = "https://git.panter.ch";

const USAGE = `catci — catladder CI companion

usage:
  catci security-audit ci-job <path> <gitlab-token> <main-branch> <project-id> <user-id>
      evaluates ${SECURITY_AUDIT_FILE_NAME}; creates a gitlab MR with the
      audit template when the document is missing (and exits 1)

  catci security-audit check <path>
      evaluates ${SECURITY_AUDIT_FILE_NAME}; exits 1 with instructions when
      the document is missing or unanswered (no remediation — works on
      any CI, including github)

  catci release changesets
      consumes pending .changeset/*.md files: computes the next version
      from the last v* tag, writes the changelog, commits, tags and
      pushes (no-op when no changesets are pending)

  catci release dispatch-tagged-workflow <tag>
      github only: dispatches the generated taggedRelease workflow for
      the tag (tags pushed with the job token don't trigger it)
`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

/**
 * shared gate: evaluates the audit document and prints the overview.
 * Returns null when the document could not be evaluated (missing or
 * unparseable) so the caller can decide on remediation.
 */
const evaluateGate = async (path: string) => {
  const evaluation = await evaluateSecurityAudit({ path });
  if (evaluation.isErr()) {
    return null;
  }
  if (evaluation.value.score.answeredTopics === 0) {
    fail(
      `audit document has no answered topics\n` +
        `please answer security topics in ${SECURITY_AUDIT_FILE_NAME} by adding responsible people and check/cross in the table`,
    );
  }
  console.log(makeSecurityAuditOverview(evaluation.value));
  return evaluation.value;
};

const securityAuditCheck = async (path: string) => {
  const evaluation = await evaluateGate(path);
  if (!evaluation) {
    fail(
      `could not evaluate ${SECURITY_AUDIT_FILE_NAME}\n` +
        `please add a ${SECURITY_AUDIT_FILE_NAME} security audit document to the repository ` +
        `(run \`catladder security audit create\` locally to generate the template)`,
    );
  }
};

const securityAuditCiJob = async (
  path: string,
  token: string,
  mainBranch: string,
  projectId: string,
  userId: string,
) => {
  const evaluation = await evaluateGate(path);
  if (evaluation) {
    return;
  }
  console.log("could not evaluate security audit document");
  console.log("creating new merge request with security audit template...");

  const api = new Gitlab({ host: GITLAB_HOST, token });
  const mr = await createSecurityAuditMergeRequest({
    api,
    mainBranch,
    projectId,
    userId: parseInt(userId),
  });

  if (mr.isErr()) {
    fail(
      `could not create merge request with security audit template: ${mr.error}`,
    );
    return;
  }
  console.log("security audit merge request created successfully");
  console.log(
    `please finish the MR by updating ${SECURITY_AUDIT_FILE_NAME}: ${mr.value.web_url}`,
  );
  process.exit(1);
};

const main = async () => {
  const [group, command, ...args] = process.argv.slice(2);
  if (group === "security-audit" && command === "ci-job" && args.length === 5) {
    const [path, token, mainBranch, projectId, userId] = args;
    return securityAuditCiJob(path, token, mainBranch, projectId, userId);
  }
  if (group === "security-audit" && command === "check" && args.length === 1) {
    return securityAuditCheck(args[0]);
  }
  if (group === "release" && command === "changesets" && args.length === 0) {
    return changesetsReleaseJob();
  }
  if (
    group === "release" &&
    command === "dispatch-tagged-workflow" &&
    args.length === 1
  ) {
    return dispatchTaggedReleaseWorkflow(args[0]);
  }
  fail(USAGE);
};

main().catch((error) => {
  fail(`catci failed: ${error instanceof Error ? error.message : error}`);
});
