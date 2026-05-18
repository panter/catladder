import { defineCommand } from "../../core/defineCommand";
import { clearBackups } from "../../utils/gitlab";

export const commandSecretsClearBackups = defineCommand({
  name: "project-secrets-clear-backups",
  description: "clears all backups",
  group: "project",
  inputs: {
    keep: {
      type: "number",
      message: "How many backups should we keep? 🤔",
      default: 1,
    },
  },
  execute: async (ctx) => {
    const keep = await ctx.get("keep");
    await clearBackups(ctx as any, keep);
  },
});
