import { defineCommand } from "../../core/defineCommand";
import { setupAccessTokens } from "../../apps/cli/commands/project/setup/setupAccessTokens";

export const commandRenewToken = defineCommand({
  name: "project-renew-token",
  description: "Configures the project access token for semantic release.",
  group: "project",
  inputs: {},
  execute: async (ctx) => {
    await setupAccessTokens(ctx as any);
  },
});
