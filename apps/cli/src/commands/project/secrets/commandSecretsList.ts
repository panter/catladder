import { getSecretVarName } from "@catladder/pipeline";
import { defineCommand } from "../../../core/defineCommand";
import {
  getScopedSecretKeys,
  resolveSecretsScope,
  secretsScopeChoices,
} from "./scope";
import { parseKeysInput } from "./parseKeysInput";

export const commandSecretsList = defineCommand({
  name: "project secrets-list",
  description:
    "lists the declared secrets of a scope with their set/unset status (values only with --reveal)",
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
    reveal: {
      type: "boolean",
      message: "also print the secret values",
      default: false,
    },
    check: {
      type: "boolean",
      message: "exit with an error when any secret is unset (for CI/agents)",
      default: false,
    },
  },
  execute: async (ctx) => {
    const scope = await resolveSecretsScope(await ctx.get("envComponent"));
    const scoped = await getScopedSecretKeys(
      scope,
      parseKeysInput(await ctx.get("key")),
    );
    const reveal = await ctx.get("reveal");

    const names = scoped.flatMap(({ env, componentName, keys }) =>
      keys.map((key) => getSecretVarName(env, componentName, key)),
    );
    const values = await (await ctx.getVaultManager()).readSecrets(names, ctx);

    let unsetCount = 0;
    let setCount = 0;
    for (const { env, componentName, keys } of scoped) {
      for (const key of keys) {
        const value = values[getSecretVarName(env, componentName, key)];
        if (value === undefined) {
          unsetCount += 1;
          ctx.log(`🚨 ${env}:${componentName} ${key} (unset)`);
        } else {
          setCount += 1;
          ctx.log(
            `✅ ${env}:${componentName} ${key}` + (reveal ? ` = ${value}` : ""),
          );
        }
      }
    }
    ctx.log("");
    ctx.log(`${setCount} set, ${unsetCount} unset`);

    if ((await ctx.get("check")) && unsetCount > 0) {
      throw new Error(`${unsetCount} secrets are unset`);
    }
  },
});
