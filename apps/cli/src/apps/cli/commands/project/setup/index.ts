import { createCatenvContext, generateAgentSkills } from "@catladder/pipeline";
import type { IO } from "../../../../../core/types";
import {
  getAllPipelineContexts,
  getProjectConfig,
} from "../../../../../config/getProjectConfig";
import { setupAccessTokens } from "./setupAccessTokens";
import { setupContext } from "./setupContext";
import { setupTopic } from "./setupTopic";
import { setupAgents } from "./setupAgents";
import { logSection } from "./logSection";
import { ensureGcloudProjectNumbers } from "./ensureGcloudProjectNumbers";

export const setupProject = async (
  instance: IO,
  onlyComponents?: string | string[],
) => {
  // refresh the agent skills first — store-independent, so it survives a
  // later failure (e.g. missing gcloud auth in ensureGcloudProjectNumbers).
  // This makes `catladder project setup` the one command that also lands
  // the skills, so agents helping a migrating project get them even when
  // catenv itself can't run yet (e.g. before the store is populated).
  const config = await getProjectConfig();
  if (config) {
    await generateAgentSkills(createCatenvContext(config));
  }

  // must come first: creating contexts already requires the store
  await ensureGcloudProjectNumbers(instance);
  const allContext = await getAllPipelineContexts(onlyComponents);
  instance.log("will setup those contexts:");
  allContext.forEach((context) => {
    instance.log(` - ${context.name}:${context.env}`);
  });

  await logSection(instance, "base setup", async () => {
    await setupAccessTokens(instance);
    await setupTopic(instance);
    await setupAgents(instance);
  });
  for (const context of allContext) {
    await setupContext(instance, context);
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
