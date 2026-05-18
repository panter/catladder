import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import type { IO } from "../../core/types";
import { openGoogleCloudDashboard } from "../openDashboard";

export const openGoogleCloudRunDashboard = async (
  instance: IO,
  context: ComponentContext,
) => {
  if (!isOfDeployType(context.deploy?.config, "google-cloudrun")) {
    throw new Error("deploy type is not google-cloudrun ");
  }
  const { fullName } = context.environment;
  const { region, projectId } = context.deploy.config;
  await openGoogleCloudDashboard(
    instance,
    `run/detail/${region}/${fullName}/metrics`,
    {
      project: projectId,
    },
  );
};
