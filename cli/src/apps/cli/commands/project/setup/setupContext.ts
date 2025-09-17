import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import type { CommandInstance } from "vorpal";
import { setupCloudRun } from "./setupCloudRun";

import { setupKubernetes } from "./setupKubernetes";
import { logSection } from "./logSection";

export const setupContext = async (
  instance: CommandInstance,
  context: ComponentContext,
) => {
  await logSection(
    instance,
    "setting up " + context.env + ":" + context.name,
    async () => {
      if (isOfDeployType(context.deploy?.config, "google-cloudrun")) {
        await setupCloudRun(instance, context);
      }

      const deployConfig = context.deploy?.config;
      if (isOfDeployType(deployConfig, "kubernetes")) {
        await setupKubernetes(instance, context);
      }
    },
  );
};
