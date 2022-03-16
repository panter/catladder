import { Context, isOfDeployType } from "@catladder/pipeline";
import { CommandInstance } from "vorpal";
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
