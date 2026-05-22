import { exec } from "child-process-promise";
import { defineCommand } from "../../../core/defineCommand";
import { getProjectNamespace } from "../../../utils/projects";
import { envAndComponents } from "../../../apps/cli/commands/project/utils/autocompletions";
import { hasDeployType } from "../../availability";

export const commandPauseProject = defineCommand({
  name: "project k8s pause",
  description: "halts all running pods (scales to 0)",
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
      "This will STOP all running pods. You will need to manually scale back up or re-deploy. Continue? 🤔 ",
    );
    if (!shouldContinue) {
      return;
    }
    const fullCommand = `kubectl scale statefulset,deployment --all --replicas=0 --namespace=${namespace}`;
    const { stdout } = await exec(fullCommand, {
      env: { ...process.env, DEBUG: "" },
    });
    ctx.log(stdout);
  },
});
