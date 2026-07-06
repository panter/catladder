import { Command, Option } from "commander";
import catenv from "./apps/catenv/catenv";
import { parseChoice } from "./config/parseChoice";
import packageInfos from "./packageInfos";
import type { SecretsMode } from "./vault";

const program = new Command();

program
  .name("catenv")
  .description("Environment variable and pipeline generation via direnv")
  .version(packageInfos.version)
  .argument("[envComponent]", "env or env:component")
  .option("-v, --verbose", "verbose output")
  .option("-p, --print-variables", "print variables")
  .addOption(
    new Option(
      "--vault-mode <mode>",
      [
        "how to interact with the secrets vault:",
        "auto: contact the vault when cached secrets are missing (may prompt to unlock)",
        "no-prompt: like auto, but fail instead of prompting",
        "offline: never contact the vault, use only locally cached secrets",
        "refresh: ignore the local cache once and refresh it from the vault",
      ].join("\n"),
    )
      .choices(["auto", "no-prompt", "offline", "refresh"])
      .default("auto"),
  )
  .action(
    (
      envComponent: string | undefined,
      opts: {
        verbose?: boolean;
        printVariables?: boolean;
        vaultMode: SecretsMode;
      },
    ) => {
      catenv(envComponent ? parseChoice(envComponent) : null, {
        verbose: opts.verbose ?? false,
        printVariables: opts.printVariables ?? false,
        vaultMode: opts.vaultMode,
      }).then(() => {
        // we have to exit manually, because we have some file watches
        process.exit();
      });
    },
  );

// Prevent Node.js from printing the (minified) source line on uncaught errors
process.on("uncaughtException", (err) => {
  console.error(err.stack ?? `${err.name}: ${err.message}`);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  if (reason instanceof Error) {
    console.error(reason.stack ?? `${reason.name}: ${reason.message}`);
  } else {
    console.error(reason);
  }
  process.exit(1);
});

program.parse();
