import type { StringOrBashExpression } from "@catladder/bash";
import { joinBashExpressions } from "@catladder/bash";
import { getCloudRunJobName } from "./jobName";

export function getCloudRunJobExecuteUrl(
  jobName: string,
  {
    region,
    projectId,
    appFullName,
  }: {
    appFullName: StringOrBashExpression;
    region: string;
    projectId: string;
  },
): StringOrBashExpression {
  const uriBase = `https://${region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${projectId}/jobs`;
  const fullJobName = getCloudRunJobName(appFullName, jobName);

  // joined, not interpolated: on review envs the job name is a bash
  // expression (the review slug), and a template string would demote
  // it to a plain string — its quotes then get escaped as literal
  // characters when the variable is exported
  return joinBashExpressions([uriBase, "/", fullJobName, ":run"]);
}
