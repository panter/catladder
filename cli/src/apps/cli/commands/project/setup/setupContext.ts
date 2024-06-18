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

  instance.log("🐱 🔧 setting up " + context.env + ":" + context.name + "...");
  instance.log("");
  if (isOfDeployType(context.deploy?.config, "google-cloudrun")) {
    await setupCloudRun(instance, context);
  }

  const deployConfig = context.deploy?.config;
  if (isOfDeployType(deployConfig, "kubernetes")) {
    await setupKubernetes(instance, context);
  }

  instance.log("");
  instance.log("✅ " + context.env + ":" + context.name + " done!");

  instance.log("");
};
