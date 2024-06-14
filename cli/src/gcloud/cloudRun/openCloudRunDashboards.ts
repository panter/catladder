import type { Context } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import type { CommandInstance } from "vorpal";
import { openGoogleCloudDashboard } from "../openDashboard";

export const openGoogleCloudRunDashboard = async (
  instance: CommandInstance,
  context: Context,
) => {
  if (!isOfDeployType(context.componentConfig.deploy, "google-cloudrun")) {
    throw new Error("deploy type is not google-cloudrun ");
  }
  const { fullName } = context.environment;
  const { region, projectId } = context.componentConfig.deploy;
  await openGoogleCloudDashboard(
    instance,
    `run/detail/${region}/${fullName}/metrics`,
    {
      project: projectId,
    },
  );
};
