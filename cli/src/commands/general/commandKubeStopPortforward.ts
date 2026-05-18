import { defineCommand } from "../../core/defineCommand";
import { stopPortForward } from "../../utils/portForwards";

export const commandKubeStopPortforward = defineCommand({
  name: "kube-stop-portforward",
  description: "stop a running port forward",
  group: "general",
  inputs: {
    name: { type: "string", message: "port forward name", positional: true },
  },
  execute: async (ctx) => {
    const name = await ctx.get("name");
    stopPortForward(name.trim());
  },
});
