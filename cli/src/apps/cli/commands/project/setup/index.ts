import { CommandInstance } from "vorpal";
import { getAllPipelineContexts } from "../../../../../config/getProjectConfig";
import { projectConfigSecrets } from "../commandConfigSecrets";
import { setupAccessTokens } from "./setupAccessTokens";
import { setupContext } from "./setupContext";

export const setupProject = async (instance: CommandInstance) => {
  const allContext = await getAllPipelineContexts();

  for (const context of allContext) {
    await setupContext(instance, context);
  }
  await setupAccessTokens(instance);
  instance.log("");
  const { configSecrets } = await instance.prompt({
    default: true,
    message: "Before deployments work, you need to config secrets. Do it now?",
    name: "configSecrets",
    type: "confirm",
  });
  instance.log("");
  if (configSecrets) {
    await projectConfigSecrets(instance);
  } else {
    instance.log(
      "👆 don't forget to config secret using `project-config-secrets`"
    );
  }
  instance.log("");
  instance.log("gitlab is ready! 🥂");
  instance.log("\n");
  instance.log("do not forget to make sure that:");
  [
    "you have __health route in place",
    "lint and test are defined",
    "secrets are configured (call project-config-secret)",
    "eat your vegetables",
    "be awesome 🤩",
  ].forEach((tip) => instance.log(` - ${tip}`));
  instance.log("\n");
  instance.log("\n");
};
