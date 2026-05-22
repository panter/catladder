import { exec } from "child-process-promise";
import { defineCommand } from "../../core/defineCommand";
import { getProjectNamespace } from "../../utils/projects";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../availability";

export const commandDeleteProject = defineCommand({
  name: "project delete",
  description: "deletes a environment of a project (it deletes the namespace)",
  group: "project",
  isAvailable: hasDeployType("kubernetes"),
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      choices: async () => envAndComponents(),
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    const namespace = await getProjectNamespace(envComponent);
    const shouldContinue = await ctx.confirm(
      "This will delete the namespace. All data will be lost. Continue? 🤔 ",
    );
    if (!shouldContinue) {
      return;
    }
    const fullCommand = `kubectl delete namespace ${namespace}`;
    const { stdout } = await exec(fullCommand, {
      env: { ...process.env, DEBUG: "" },
    });
    ctx.log(stdout);
  },
});
