import type { ComponentContext } from "@catladder/pipeline";
import { isOfDeployType } from "@catladder/pipeline";
import type { CommandInstance } from "vorpal";
import { setupCloudRun } from "./setupCloudRun";

import { setupKubernetes } from "./setupKubernetes";

export const setupContext = async (
  instance: CommandInstance,
  context: ComponentContext,
) => {
  instance.log("");
  instance.log(
    "==================================================================================",
  );

  instance.log(
    "🐱 🔧 setting up " +
      context.environment.shortName +
      ":" +
      context.componentName +
      "...",
  );
  instance.log("");
  if (isOfDeployType(context.componentConfig.deploy, "google-cloudrun")) {
    await setupCloudRun(instance, context);
  }

  const deployConfig = context.componentConfig.deploy;
  if (isOfDeployType(deployConfig, "kubernetes")) {
    await setupKubernetes(instance, context);
  }

  instance.log("");
  instance.log(
    "✅ " +
      context.environment.shortName +
      ":" +
      context.componentName +
      " done!",
  );

  instance.log("");
};
