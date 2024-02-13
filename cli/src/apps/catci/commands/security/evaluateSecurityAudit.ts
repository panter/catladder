import { Result } from "ts-results-es";
import { join } from "path";
import { readFile } from "fs/promises";
import { SECURITY_AUDIT_FILE_NAME } from "./createSecurityAuditMergeRequest";
import type { SecurityEvaluation } from "./auditDocument";
import { evaluateDocument } from "./auditDocument";

export async function evaluateSecurityAudit({ path }: { path: string }) {
  return (
    await Result.wrapAsync(async () => {
      const filePath = join(path, SECURITY_AUDIT_FILE_NAME);
      const docData = await readFile(filePath);
      const doc = docData.toString("utf-8");
      return evaluateDocument(doc);
    })
  ).mapErr((e) => `could not evaluate ${SECURITY_AUDIT_FILE_NAME}: ${e}`);
}

export function makeSecurityAuditOverview(evaluation: SecurityEvaluation) {
  const ratingToEmo = (r: number) => (r < 33 ? "🟥" : r < 66 ? "🟨" : "🟩");

  return `Project security posture overview:
 🧐 Total topics: ${evaluation.score.totalTopics}
 🔒 Secured topics: ${evaluation.score.securedTopics}
 📢 Answered topics: ${evaluation.score.answeredTopics}
 ❔ Unknown topics: ${evaluation.score.unknownTopics}
 📊 Rating: ${ratingToEmo(evaluation.score.rating)} ${
    evaluation.score.rating
  }/100`;
}
