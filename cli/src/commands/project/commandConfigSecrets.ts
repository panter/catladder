import { defineCommand } from "../../core/defineCommand";
import { projectConfigSecrets } from "../../apps/cli/commands/project/commandConfigSecrets";
import { envAndComponents } from "../../apps/cli/commands/project/utils/autocompletions";

// This command delegates to the existing implementation which uses
// editAsFile (opens editor) and has retry loops with confirm prompts.
// Full migration to CommandIO would require reworking the editor flow,
// so for now we bridge it.
export const commandConfigSecrets = defineCommand({
  name: "project config-secrets",
  description: "setup/update secrets stored in pass",
  group: "project",
  inputs: {
    envComponent: {
      type: "string",
      message: "environment:component",
      positional: true,
      required: false,
      choices: async () => envAndComponents(),
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    // Bridge: the existing implementation accepts CommandInstance-like
    // objects for logging and prompting. Since it uses this.prompt()
    // internally (not ctx.prompt), we pass ctx which satisfies the
    // IO interface for logging. The interactive prompts inside
    // projectConfigSecrets will need a deeper migration later.
    await projectConfigSecrets(ctx, envComponent);
  },
});
