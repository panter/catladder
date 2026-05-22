import type { ComponentContext } from "@catladder/pipeline";
import { Command } from "commander";
import { createTerminalContext } from "./adapters/terminal";
import {
  generateZshCompletionScript,
  getCompletions,
  installCompletions,
  uninstallCompletions,
} from "./completion";
import { getAllPipelineContexts } from "./config/getProjectConfig";
import type { CommandDef } from "./core/types";
import packageInfos from "./packageInfos";
import { stopAllPortForwards } from "./utils/portForwards";

// Import all commands
import * as commands from "./commands";

const program = new Command();

program
  .name("catladder")
  .description("Panter CLI tool for cloud CI/CD and DevOps")
  .version(packageInfos.version)
  .option("-y, --yes", "skip all confirmation prompts");

// Collect all command defs for completion
const allCommandDefs: CommandDef[] = [];

// Cache for intermediate subcommand groups (e.g., "project", "project cloudsql")
const subcommandCache = new Map<string, Command>();

/**
 * Get or create a chain of nested subcommands.
 * E.g., for ["project", "cloudsql"], ensures program.command("project").command("cloudsql") exists.
 */
function getOrCreateParent(parts: string[]): Command {
  if (parts.length === 0) return program;

  const key = parts.join(" ");
  if (subcommandCache.has(key)) return subcommandCache.get(key)!;

  const parent = getOrCreateParent(parts.slice(0, -1));
  const cmd = parent.command(parts[parts.length - 1]);
  subcommandCache.set(key, cmd);
  return cmd;
}

/**
 * Register a CommandDef with Commander.js.
 * - Command name can contain spaces for nesting (e.g., "project cloudsql proxy")
 * - Inputs with `positional: true` become Commander positional args
 * - Other inputs become optional --flags
 * - --inputs accepts JSON for programmatic use
 */
function registerCommand(def: CommandDef): void {
  allCommandDefs.push(def);

  // Separate positional inputs from flag inputs
  const positionalInputs: [string, (typeof def.inputs)[string]][] = [];
  const flagInputs: [string, (typeof def.inputs)[string]][] = [];

  for (const [name, inputDef] of Object.entries(def.inputs)) {
    if (inputDef.positional) {
      positionalInputs.push([name, inputDef]);
    } else {
      flagInputs.push([name, inputDef]);
    }
  }

  // Split name into parent groups + leaf command
  const nameParts = def.name.split(" ");
  const parentParts = nameParts.slice(0, -1);
  const leafName = nameParts[nameParts.length - 1];

  // Build leaf command string with positional args
  let cmdStr = leafName;
  for (const [name] of positionalInputs) {
    cmdStr += ` [${name}]`;
  }

  const parent = getOrCreateParent(parentParts);
  const cmd = parent.command(cmdStr).description(def.description);

  // Add --flag for each non-positional input
  for (const [name, inputDef] of flagInputs) {
    const flagName = name.replace(/([A-Z])/g, "-$1").toLowerCase();
    const desc = inputDef.message.replace(/\s*🤔\s*$/, "").trim();
    if (inputDef.type === "boolean") {
      cmd.option(`--${flagName}`, desc);
      cmd.option(`--no-${flagName}`, `negate: ${desc}`);
    } else {
      cmd.option(`--${flagName} <value>`, desc);
    }
  }

  // Add --inputs for JSON input
  cmd.option("--inputs <json>", "JSON object with input values");

  cmd.action(async (...rawArgs: any[]) => {
    // Commander passes positional args first, then options object, then the Command
    const opts = rawArgs[rawArgs.length - 2];

    // Parse positional args into cliOptions
    const cliOptions: Record<string, unknown> = {};
    positionalInputs.forEach(([name], i) => {
      if (rawArgs[i] !== undefined) {
        cliOptions[name] = rawArgs[i];
      }
    });

    // Parse CLI flag overrides
    for (const [name, inputDef] of flagInputs) {
      const flagName = name.replace(/([A-Z])/g, "-$1").toLowerCase();
      const camelName = flagName.replace(/-([a-z])/g, (_, c) =>
        c.toUpperCase(),
      );
      if (opts[camelName] !== undefined) {
        let value = opts[camelName];
        if (inputDef.type === "number" && typeof value === "string") {
          value = Number(value);
        }
        cliOptions[name] = value;
      }
    }

    // Parse --inputs JSON
    let jsonInputs: Record<string, unknown> = {};
    if (opts.inputs) {
      try {
        jsonInputs = JSON.parse(opts.inputs);
      } catch {
        console.error("Error: --inputs must be valid JSON");
        process.exit(1);
      }
    }

    const ctx = createTerminalContext(def, {
      cliOptions,
      jsonInputs,
      yes: program.opts().yes,
    });

    try {
      await def.execute(ctx);
    } catch (err: any) {
      if (err.name === "MissingInputError") {
        console.error(`\n${err.message}\n`);
        process.exit(1);
      }
      throw err;
    }
  });
}

// Register all commands (async to support isAvailable checks)
async function registerAllCommands() {
  // Fetch contexts once for all isAvailable checks
  let contexts: ComponentContext[] = [];
  try {
    contexts = await getAllPipelineContexts();
  } catch {
    // No config available (e.g. outside a project) — contexts stays empty
  }

  for (const cmd of Object.values(commands)) {
    if (cmd && typeof cmd === "object" && "name" in cmd && "execute" in cmd) {
      const def = cmd as CommandDef;
      if (def.isAvailable) {
        if (!def.isAvailable(contexts)) continue;
      }
      registerCommand(def);
    }
  }
}

// Hidden __complete command for shell completion
program
  .command("__complete", { hidden: true })
  .argument("[words]", "words typed so far")
  .argument("[cursor]", "word at cursor")
  .action(async (wordsStr: string | undefined, cursor: string | undefined) => {
    const words = wordsStr ? wordsStr.split(" ").filter(Boolean) : [];
    const cursorWord = cursor ?? "";
    try {
      const completions = await getCompletions(
        allCommandDefs,
        words,
        cursorWord,
      );
      for (const c of completions) {
        console.log(c);
      }
    } catch {
      // Silently fail -- completion should never break the shell
    }
    process.exit(0);
  });

// completion commands
const completionCmd = program
  .command("completion")
  .description("shell completion setup");

completionCmd
  .command("zsh")
  .description("output zsh completion script")
  .action(() => {
    console.log(generateZshCompletionScript());
  });

completionCmd
  .command("install")
  .description("install shell completions into your .zshrc")
  .action(async () => {
    await installCompletions();
  });

completionCmd
  .command("uninstall")
  .description("remove shell completions from your .zshrc")
  .action(async () => {
    await uninstallCompletions();
  });

// Cleanup on exit
process.on("exit", () => {
  stopAllPortForwards();
});

registerAllCommands().then(() => program.parse());
