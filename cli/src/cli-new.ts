import { Command } from "commander";
import packageInfos from "./packageInfos";
import { stopAllPortForwards } from "./utils/portForwards";
import { createTerminalContext } from "./adapters/terminal";
import type { CommandDef } from "./core/types";

// Import all commands
import * as commands from "./commands";

const program = new Command();

program
  .name("catladder")
  .description("Panter CLI tool for cloud CI/CD and DevOps")
  .version(packageInfos.version)
  .option("-y, --yes", "skip all confirmation prompts");

/**
 * Register a CommandDef with Commander.js.
 * - Inputs with `positional: true` become Commander positional args
 * - Other inputs become optional --flags
 * - --inputs accepts JSON for programmatic use
 */
function registerCommand(def: CommandDef): void {
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

  // Build the command string with positional args.
  // All positionals are registered as optional in Commander so that
  // ctx.get() can prompt for them interactively when missing.
  let cmdStr = def.name;
  for (const [name] of positionalInputs) {
    cmdStr += ` [${name}]`;
  }

  const cmd = program.command(cmdStr).description(def.description);

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

// Register all commands
for (const cmd of Object.values(commands)) {
  if (cmd && typeof cmd === "object" && "name" in cmd && "execute" in cmd) {
    registerCommand(cmd as CommandDef);
  }
}

// Cleanup on exit
process.on("exit", () => {
  stopAllPortForwards();
});

program.parse();
