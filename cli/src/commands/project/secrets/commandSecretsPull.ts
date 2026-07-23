import { writeFile } from "fs-extra";
import { stringify } from "yaml";
import { defineCommand } from "../../../core/defineCommand";
import { buildSecretsDocument } from "./document";
import {
  getScopedSecretKeys,
  resolveSecretsScope,
  secretsScopeChoices,
} from "./scope";
import { parseKeysInput } from "./parseKeysInput";

export const commandSecretsPull = defineCommand({
  name: "project secrets-pull",
  description:
    "prints the current secrets of a scope as yaml (unset ones as a placeholder) — edit and feed to secrets-push",
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
      message: "only these secrets (comma-separated keys)",
      required: false,
    },
    out: {
      type: "string",
      message: "write the yaml to this file instead of stdout",
      required: false,
    },
  },
  execute: async (ctx) => {
    const scope = await resolveSecretsScope(await ctx.get("envComponent"));
    const scoped = await getScopedSecretKeys(
      scope,
      parseKeysInput(await ctx.get("key")),
    );
    const document = await buildSecretsDocument(ctx, scoped);
    const yaml = stringify(document, { aliasDuplicateObjects: false });

    const out = await ctx.get("out");
    if (out) {
      await writeFile(out, yaml);
      ctx.log(
        `wrote secrets to ${out} — ⚠️ contains secret values, don't commit it`,
      );
    } else {
      ctx.log(yaml);
    }
  },
});
