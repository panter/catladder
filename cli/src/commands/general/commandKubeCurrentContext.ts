import { defineCommand } from "../../core/defineCommand";
import { getCurrentContext } from "../../utils/cluster";

export const commandKubeCurrentContext = defineCommand({
  name: "kube-current-context",
  description: "show current kubernetes context",
  group: "general",
  inputs: {},
  execute: async (ctx) => {
    ctx.log(await getCurrentContext());
  },
});
