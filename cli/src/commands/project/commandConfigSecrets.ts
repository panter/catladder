import { stripIndents } from "common-tags";
import { defineCommand } from "../../core/defineCommand";
import { editAsFile } from "../../utils/editAsFile";
import { delay } from "../../utils/promise";
import {
  buildSecretsDocument,
  checkSecretsDocument,
  collectSecretsWrites,
  writeSecretsAndMirror,
} from "./secrets/document";
import {
  formatScope,
  getScopedSecretKeys,
  resolveSecretsScope,
  secretsScopeChoices,
} from "./secrets/scope";
import { parseKeysInput } from "./secrets/parseKeysInput";

export const commandConfigSecrets = defineCommand({
  name: "project config-secrets",
  description: "setup/update secrets in the vault via your editor",
  group: "project",
  inputs: {
    envComponent: {
      type: "string",
      message: "scope: env:component, env:, :component or empty for everything",
      positional: true,
      required: false,
      choices: async () => secretsScopeChoices(),
    },
    key: {
      type: "string",
      message: "only edit these secrets (comma-separated keys)",
      required: false,
    },
  },
  execute: async (ctx) => {
    const envComponent = await ctx.get("envComponent");
    const keys = parseKeysInput(await ctx.get("key"));

    if (!ctx.interactive) {
      throw new Error(
        "project config-secrets opens an editor and needs an interactive terminal — " +
          "use `project secrets-pull`, `project secrets-push` or `project secrets-set` instead",
      );
    }

    const scope = await resolveSecretsScope(envComponent);
    const scoped = await getScopedSecretKeys(scope, keys);

    let document = await buildSecretsDocument(ctx, scoped);
    let hasErrors = true;
    while (hasErrors) {
      document = await editAsFile(
        document,
        stripIndents`
        Please fill in all secrets for:

        ${formatScope(scoped)}

        `,
      );
      const problems = checkSecretsDocument(document, scoped, {
        requireComplete: true,
      });
      hasErrors = problems.length > 0;
      if (hasErrors) {
        ctx.log("");
        ctx.log("😿 Oh no! There is something wrong:");
        ctx.log("");
        problems.forEach((problem) => ctx.log(problem));
        ctx.log("");

        await delay(1000);
        const shouldContinue = await ctx.confirm("Try again? 🤔");
        if (!shouldContinue) {
          throw new Error("abort");
        }
      }
    }

    const { writes, skipped } = collectSecretsWrites(document, scoped);
    if (skipped.length > 0) {
      ctx.log("");
      ctx.log("⏭️ these secrets are still unset and will not be written:");
      skipped.forEach((entry) => ctx.log(`  - ${entry}`));
    }
    await writeSecretsAndMirror(ctx, writes);
    ctx.log("done! 😻");
    ctx.log("");
  },
});
