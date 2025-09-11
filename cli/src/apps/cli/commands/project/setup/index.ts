import type { CommandInstance } from "vorpal";
import { getAllPipelineContexts } from "../../../../../config/getProjectConfig";
import { setupAccessTokens } from "./setupAccessTokens";
import { setupContext } from "./setupContext";
import { setupTopic } from "./setupTopic";
import { setupAgents } from "./setupAgents";

export const setupProject = async (
  instance: CommandInstance,
  onlyComponents?: string | string[],
) => {
  const allContext = await getAllPipelineContexts(onlyComponents);
  instance.log("will setup those contexts:");
  allContext.forEach((context) => {
    instance.log(` - ${context.name}:${context.env}`);
  });
  for (const context of allContext) {
    await setupContext(instance, context);
  }
  await setupAccessTokens(instance);
  await setupTopic(instance);
  await setupAgents(instance);
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
