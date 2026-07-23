import { readFile } from "fs-extra";
import { parse } from "yaml";
import { defineCommand } from "../../../core/defineCommand";
import { readStdin } from "../../../utils/readStdin";
import type { SecretsDocument } from "./document";
import {
  checkSecretsDocument,
  collectSecretsWrites,
  writeSecretsAndMirror,
} from "./document";
import {
  getScopedSecretKeys,
  resolveSecretsScope,
  secretsScopeChoices,
} from "./scope";
import { parseKeysInput } from "./parseKeysInput";

export const commandSecretsPush = defineCommand({
  name: "project secrets-push",
  description:
    "writes secrets from a yaml document (secrets-pull format, --file or stdin) to the vault; may be partial",
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
      message: "only write these secrets (comma-separated keys)",
      required: false,
    },
    file: {
      type: "string",
      message:
        "yaml file to push (component → env → key: value); stdin when omitted",
      required: false,
    },
  },
  execute: async (ctx) => {
    const scope = await resolveSecretsScope(await ctx.get("envComponent"));
    const scoped = await getScopedSecretKeys(
      scope,
      parseKeysInput(await ctx.get("key")),
    );

    const file = await ctx.get("file");
    if (!file && process.stdin.isTTY) {
      throw new Error(
        "nothing to push — pass --file <secrets.yml> or pipe yaml (secrets-pull format) to stdin",
      );
    }
    const raw = file
      ? (await readFile(file)).toString("utf-8")
      : await readStdin();
    const document = parse(raw) as SecretsDocument;
    if (!document || typeof document !== "object") {
      throw new Error(
        "the document must be a yaml object: component → env → key: value (see secrets-pull)",
      );
    }

    const problems = checkSecretsDocument(document, scoped, {
      requireComplete: false,
    });
    if (problems.length > 0) {
      throw new Error(
        "😿 the document does not match the config:\n" +
          problems.map((problem) => `  - ${problem}`).join("\n"),
      );
    }

    const { writes, skipped } = collectSecretsWrites(document, scoped);
    if (skipped.length > 0) {
      ctx.log("⏭️ skipping placeholder/empty values:");
      skipped.forEach((entry) => ctx.log(`  - ${entry}`));
    }
    if (writes.length === 0) {
      ctx.log("no secrets to write 🤷");
      return;
    }

    ctx.log("about to write:");
    writes.forEach(({ env, componentName, secrets }) =>
      ctx.log(
        `  - ${env}:${componentName}: ${Object.keys(secrets).join(", ")}`,
      ),
    );
    const confirmed = await ctx.confirm("continue? 🤔");
    if (!confirmed) {
      throw new Error("abort");
    }

    await writeSecretsAndMirror(ctx, writes);
    ctx.log("done! 😻");
  },
});
