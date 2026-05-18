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
  // If no command yet, complete command names
  if (words.length === 0) {
    return allCommands
      .map((c) => c.name)
      .filter((name) => name.startsWith(cursorWord));
  }

  const commandName = words[0];
  const command = allCommands.find((c) => c.name === commandName);

  // If the first word doesn't match a command, complete command names
  if (!command) {
    return allCommands
      .map((c) => c.name)
      .filter((name) => name.startsWith(commandName));
  }

  // We have a valid command. Figure out what to complete.
  const argsAfterCommand = words.slice(1);

  // Check if we're completing a --flag value
  const prevWord = argsAfterCommand[argsAfterCommand.length - 1];
  if (prevWord?.startsWith("--")) {
    // Previous word is a flag, complete its values
    const flagName = prevWord.replace(/^--/, "");
    const inputName = flagNameToInputName(flagName);
    const inputDef = command.inputs[inputName];
    if (inputDef && "choices" in inputDef && inputDef.choices) {
      return resolveChoicesForCompletion(inputDef, cursorWord);
    }
    return [];
  }

  // Check if we're typing a --flag name
  if (cursorWord.startsWith("--")) {
    return getFlagCompletions(command, cursorWord);
  }

  // Otherwise, complete positional inputs
  const positionalInputs = getPositionalInputs(command);
  const positionalArgs = argsAfterCommand.filter((w) => !w.startsWith("--"));

  // Which positional index are we on?
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
