import type {
  DeployConfigCloudRunExecuteOnDeploy,
  DeployConfigCloudRunJob,
  DeployConfigCloudRunService,
} from "../../types";

export const getCloudRunServiceOrJobArgsArg = (
  args:
    | DeployConfigCloudRunExecuteOnDeploy["args"]
    | DeployConfigCloudRunJob["args"]
    | DeployConfigCloudRunService["args"],
) => {
  return args !== undefined
    ? args.length > 0
      ? args?.map((arg) => `"${arg}"`).join(",")
      : ""
    : undefined;
};
