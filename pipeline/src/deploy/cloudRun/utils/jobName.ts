export const getCloudRunJobName = (fullAppName: string, jobName: string) =>
  fullAppName.toLowerCase() + "-" + jobName.toLowerCase();
