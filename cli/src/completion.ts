import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { CommandDef, InputDef } from "./core/types";

/**
 * Generate completions for the current command line.
 *
 * @param allCommands - All registered command definitions
 * @param words - The words typed so far (argv without the binary name)
 * @param cursorWord - The word currently being completed (may be empty)
 * @returns Array of completion strings
 */
export async function getCompletions(
  allCommands: CommandDef[],
  words: string[],
  cursorWord: string,
): Promise<string[]> {
  // Try to match words against command names (which can be multi-word)
  // Walk through words, consuming them as command name parts until we find
  // an exact command match or need to suggest the next subcommand level.

  // Find all commands whose name starts with the words typed so far
  const typed = words.join(" ");

  // Exact match: we've typed a full command name, now complete its inputs
  const exactCommand = allCommands.find((c) => c.name === typed);
  if (exactCommand) {
    // Check if cursor is a --flag
    if (cursorWord.startsWith("--")) {
      return getFlagCompletions(exactCommand, cursorWord);
    }

    // Check if previous word was a --flag (complete its value)
    const prevWord = words[words.length - 1];
    if (prevWord?.startsWith("--")) {
      const flagName = prevWord.replace(/^--/, "");
      const inputName = flagNameToInputName(flagName);
      const inputDef = exactCommand.inputs[inputName];
      if (inputDef && "choices" in inputDef && inputDef.choices) {
        return resolveChoicesForCompletion(inputDef, cursorWord);
      }
      return [];
    }

    // Complete positional inputs
    const positionalInputs = getPositionalInputs(exactCommand);
    // Count non-flag args after the command name
    const argsAfterCommand = words.slice(exactCommand.name.split(" ").length);
    const positionalArgs = argsAfterCommand.filter((w) => !w.startsWith("--"));
    const positionalIndex = positionalArgs.length;
    const targetInput = positionalInputs[positionalIndex];

    if (targetInput) {
      const [, inputDef] = targetInput;
      if ("choices" in inputDef && inputDef.choices) {
        return resolveChoicesForCompletion(inputDef, cursorWord);
      }
    }
    return [];
  }

  // No exact match. Complete the next level of subcommand names.
  // The prefix is what's been typed so far (words joined with space).
  const prefix = typed ? typed + " " : "";

  // Find unique next-level subcommand names
  const nextParts = new Set<string>();
  for (const cmd of allCommands) {
    if (cmd.name.startsWith(prefix)) {
      // Get the next word after the prefix
      const rest = cmd.name.slice(prefix.length);
      const nextPart = rest.split(" ")[0];
      if (nextPart && nextPart.startsWith(cursorWord)) {
        nextParts.add(nextPart);
      }
    }
  }

  return [...nextParts].sort();
}

function getPositionalInputs(command: CommandDef): [string, InputDef][] {
  return Object.entries(command.inputs).filter(([, def]) => def.positional);
}

function getFlagCompletions(command: CommandDef, cursorWord: string): string[] {
  const flags: string[] = [];
  for (const [name, inputDef] of Object.entries(command.inputs)) {
    if (inputDef.positional) continue;
    const flagName = `--${name.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    flags.push(flagName);
  }
  flags.push("--inputs");
  flags.push("--yes");
  return flags.filter((f) => f.startsWith(cursorWord));
}

function flagNameToInputName(flagName: string): string {
  return flagName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

async function resolveChoicesForCompletion(
  inputDef: InputDef,
  cursorWord: string,
): Promise<string[]> {
  if (!("choices" in inputDef) || !inputDef.choices) return [];
  try {
    // Create a minimal ctx that returns empty for any get() call.
    // This works for choices functions that don't depend on other inputs
    // (like envAndComponents). For dependent choices, completion won't work
    // but that's acceptable -- those are typically non-positional.
    const noopCtx = {
      get: () => Promise.reject(new Error("not available during completion")),
      log: () => {},
      confirm: () => Promise.resolve(true),
      promptDirect: () =>
        Promise.reject(new Error("not available during completion")),
    };
    const choices = await inputDef.choices(noopCtx);
    return choices
      .map((c) => (typeof c === "string" ? c : c.value))
      .filter((v) => v.startsWith(cursorWord));
  } catch {
    // If choices function fails (e.g., needs other inputs), return nothing
    return [];
  }
}

/**
 * Generate the zsh completion script.
 * The user adds `eval "$(catladder completion zsh)"` to their .zshrc.
 */
export function generateZshCompletionScript(binaryName: string): string {
  const funcName = binaryName.replace(/-/g, "_");
  return `
###-begin-${funcName}-completions-###
_${funcName}_completions() {
  local -a completions
  local current_word="\${words[$CURRENT]}"

  # Words after the binary name, excluding the current word being completed
  local -a cmd_words=(\${words:1:$((CURRENT-2))})

  # Call the CLI's __complete command
  completions=(\${(f)"$(${binaryName} __complete -- "\${cmd_words[*]}" "$current_word" 2>/dev/null)"})

  if [[ \${#completions[@]} -gt 0 ]]; then
    compadd -a completions
  fi
}

compdef _${funcName}_completions ${binaryName}
###-end-${funcName}-completions-###
`.trim();
}

const BEGIN_MARKER = (name: string) =>
  `###-begin-${name.replace(/-/g, "_")}-completions-###`;

function getZshrcPath(): string {
  return join(homedir(), ".zshrc");
}

/**
 * Install completions by adding an eval line to .zshrc.
 */
export async function installCompletions(binaryName: string): Promise<void> {
  const zshrcPath = getZshrcPath();
  const evalLine = `eval "$(${binaryName} completion zsh)"`;
  const marker = BEGIN_MARKER(binaryName);

  let content = "";
  if (existsSync(zshrcPath)) {
    content = readFileSync(zshrcPath, "utf-8");
  }

  if (content.includes(marker)) {
    console.log(
      `Completions for ${binaryName} are already installed in ${zshrcPath}`,
    );
    return;
  }

  const addition = `\n# ${binaryName} shell completions\n${evalLine}\n`;
  writeFileSync(zshrcPath, content + addition);
  console.log(`Installed completions for ${binaryName} in ${zshrcPath}`);
  console.log(`Restart your shell or run: source ${zshrcPath}`);
}

/**
 * Remove completions from .zshrc.
 */
export async function uninstallCompletions(binaryName: string): Promise<void> {
  const zshrcPath = getZshrcPath();
  if (!existsSync(zshrcPath)) {
    console.log("No .zshrc found");
    return;
  }

  const content = readFileSync(zshrcPath, "utf-8");
  const evalLine = `eval "$(${binaryName} completion zsh)"`;
  const commentLine = `# ${binaryName} shell completions`;

  if (!content.includes(evalLine)) {
    console.log(`No completions for ${binaryName} found in ${zshrcPath}`);
    return;
  }

  const cleaned = content
    .replace(
      new RegExp(
        `\\n?${commentLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
        "g",
      ),
      "\n",
    )
    .replace(
      new RegExp(
        `\\n?${evalLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n?`,
        "g",
      ),
      "\n",
    );

  writeFileSync(zshrcPath, cleaned);
  console.log(`Removed completions for ${binaryName} from ${zshrcPath}`);
  console.log(`Restart your shell or run: source ${zshrcPath}`);
}
