import type { StringOrBashExpression } from "../../../bash";
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
): string {
  const uriBase = `https://${region}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${projectId}/jobs`;
  const fullJobName = getCloudRunJobName(appFullName, jobName);

  return `${uriBase}/${fullJobName}:run`;
}
