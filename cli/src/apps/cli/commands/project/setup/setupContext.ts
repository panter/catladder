import type { Context } from "@catladder/pipeline";
import { isOfDeployType, hasKubernetesCloudSQL } from "@catladder/pipeline";
import type { CommandInstance } from "vorpal";
import { setupCloudRun } from "./setupCloudRun";
import { setupCloudSQL } from "./setupCloudSQL";
import { setupKubernetes } from "./setupKubernetes";

export const setupContext = async (
  instance: CommandInstance,
  context: Context
) => {
  instance.log("");
  instance.log(
    "=================================================================================="
  );

  instance.log(
    "🐱 🔧 setting up " +
      context.environment.shortName +
      ":" +
      context.componentName +
      "..."
  );
  instance.log("");
  if (isOfDeployType(context.componentConfig.deploy, "google-cloudrun")) {
    await setupCloudRun(instance, context);
  }
  if (hasKubernetesCloudSQL(context)) {
    await setupCloudSQL(instance, context);
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
      " done!"
  );

  instance.log("");
};
