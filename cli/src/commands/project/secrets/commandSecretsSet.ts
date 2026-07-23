import { readFile } from "fs-extra";
import { defineCommand } from "../../../core/defineCommand";
import type { IO } from "../../../core/types";
import { readStdin } from "../../../utils/readStdin";
import type { SecretsWrite } from "./document";
import { writeSecretsAndMirror } from "./document";
import {
  getScopedSecretKeys,
  resolveSecretsScope,
  secretsScopeChoices,
} from "./scope";

const resolveValue = async (
  io: IO,
  value: string | undefined,
  valueFile: string | undefined,
): Promise<string> => {
  if (valueFile) {
    // a trailing newline is almost never part of the secret
    return (await readFile(valueFile)).toString("utf-8").replace(/\n$/, "");
  }
  if (value !== undefined) {
    return value;
  }
  if (!process.stdin.isTTY) {
    return (await readStdin()).replace(/\n$/, "");
  }
  return io.promptDirect({
    name: "value",
    type: "string",
    message: "value",
  });
};

export const commandSecretsSet = defineCommand({
  name: "project secrets-set",
  description:
    "sets one secret — in one env (dev:web), one env everywhere (dev:), or all envs of a component (:web); value via --value, --value-file or stdin",
  group: "project",
  inputs: {
    envComponent: {
      type: "string",
      message: "scope: env:component, env:, or :component",
      positional: true,
      choices: async () => secretsScopeChoices(),
    },
    key: {
      type: "string",
      message: "which secret?",
      positional: true,
      choices: async (ctx) => {
        const scope = await resolveSecretsScope(await ctx.get("envComponent"));
        const scoped = await getScopedSecretKeys(scope);
        return [...new Set(scoped.flatMap(({ keys }) => keys))];
      },
    },
    value: {
      type: "string",
      message:
        "the secret value (prefer --value-file or stdin over shell history)",
      required: false,
    },
    valueFile: {
      type: "string",
      message: "read the secret value from this file",
      required: false,
    },
  },
  execute: async (ctx) => {
    const scope = await resolveSecretsScope(await ctx.get("envComponent"));
    const key = await ctx.get("key");
    // drops env/component pairs where the key is not declared and
    // throws when it is declared nowhere in the scope
    const scoped = await getScopedSecretKeys(scope, [key]);
    const value = await resolveValue(
      ctx,
      await ctx.get("value"),
      await ctx.get("valueFile"),
    );

    const targets = scoped.map(
      ({ env, componentName }) => `${env}:${componentName}`,
    );
    ctx.log(`setting ${key} in: ${targets.join(", ")}`);
    if (targets.length > 1) {
      const confirmed = await ctx.confirm(
        `write the same value to ${targets.length} environments? 🤔`,
      );
      if (!confirmed) {
        throw new Error("abort");
      }
    }

    const writes: SecretsWrite[] = scoped.map(({ env, componentName }) => ({
      env,
      componentName,
      secrets: { [key]: value },
    }));
    await writeSecretsAndMirror(ctx, writes);
    ctx.log("done! 😻");
  },
});
