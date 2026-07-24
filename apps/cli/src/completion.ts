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
  // Try to find a command by matching the longest prefix of words.
  // E.g., for words ["project", "cloudsql", "restore-db", "--source"],
  // we match "project cloudsql restore-db" and treat ["--source"] as args.
  const matched = findCommand(allCommands, words);

  if (matched) {
    const { command, argsAfterCommand } = matched;

    // Check if cursor is a --flag name
    if (cursorWord.startsWith("--")) {
      return getFlagCompletions(command, cursorWord);
    }

    // Check if previous word was a --flag (complete its value)
    const prevWord = argsAfterCommand[argsAfterCommand.length - 1];
    if (prevWord?.startsWith("--")) {
      const flagName = prevWord.replace(/^--/, "");
      const inputName = flagNameToInputName(flagName);
      const inputDef = command.inputs[inputName];
      if (inputDef && "choices" in inputDef && inputDef.choices) {
        return resolveChoicesForCompletion(inputDef, cursorWord);
      }
      return [];
    }

    // Complete positional inputs
    const positionalInputs = getPositionalInputs(command);
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

  // No command matched. Complete subcommand names at the current level.
  const typed = words.join(" ");
  const prefix = typed ? typed + " " : "";

  const nextParts = new Set<string>();
  for (const cmd of allCommands) {
    if (cmd.name.startsWith(prefix)) {
      const rest = cmd.name.slice(prefix.length);
      const nextPart = rest.split(" ")[0];
      if (nextPart && nextPart.startsWith(cursorWord)) {
        nextParts.add(nextPart);
      }
    }
  }

  return [...nextParts].sort();
}

/**
 * Find a command by matching the longest prefix of words against command names.
 * Returns the matched command and the remaining words (args/flags after the command name).
 */
function findCommand(
  allCommands: CommandDef[],
  words: string[],
): { command: CommandDef; argsAfterCommand: string[] } | null {
  // Try longest match first
  for (let i = words.length; i >= 1; i--) {
    const candidate = words.slice(0, i).join(" ");
    const command = allCommands.find((c) => c.name === candidate);
    if (command) {
      return { command, argsAfterCommand: words.slice(i) };
    }
  }
  return null;
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
 * The script discovers the local catladder binary at completion time,
 * so it works without a global install.
 */
export function generateZshCompletionScript(): string {
  return `
###-begin-catladder-completions-###
# Find catladder binary by walking up from cwd
_catladder_find_binary() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -x "$dir/node_modules/.bin/catladder" ]]; then
      echo "$dir/node_modules/.bin/catladder"
      return
    fi
    # Also check for catladder-dev (monorepo development)
    if [[ -x "$dir/apps/cli/bin/catladder-dev" ]]; then
      echo "$dir/apps/cli/bin/catladder-dev"
      return
    fi
    dir="\${dir:h}"
  done
  # Fall back to global
  if command -v catladder &>/dev/null; then
    echo "catladder"
  elif command -v catladder-dev &>/dev/null; then
    echo "catladder-dev"
  fi
}

# Run completion with given offset (number of words to skip before CLI args)
_catladder_do_complete() {
  local skip=$1
  local catladder_bin=$(_catladder_find_binary)
  [[ -z "$catladder_bin" ]] && return

  local -a completions
  local current_word="\${words[$CURRENT]}"
  local -a cmd_words=(\${words:$skip:$((CURRENT-skip-1))})

  completions=(\${(f)"$($catladder_bin __complete -- "\${cmd_words[*]}" "$current_word" 2>/dev/null)"})

  if [[ \${#completions[@]} -gt 0 ]]; then
    compadd -a completions
  fi
}

# catladder <TAB>
_catladder_completions() { _catladder_do_complete 1; }

# yarn catladder <TAB>
_yarn_catladder_completions() {
  [[ $CURRENT -le 2 || "\${words[2]}" != "catladder" ]] && return
  _catladder_do_complete 2
}

compdef _catladder_completions catladder
compdef _catladder_completions catladder-dev
compdef _yarn_catladder_completions yarn
###-end-catladder-completions-###
`.trim();
}

const BEGIN_MARKER = "###-begin-catladder-completions-###";
const END_MARKER = "###-end-catladder-completions-###";

function getZshrcPath(): string {
  return join(homedir(), ".zshrc");
}

/**
 * Install completions by writing the script directly into .zshrc.
 */
export async function installCompletions(): Promise<void> {
  const zshrcPath = getZshrcPath();

  let content = "";
  if (existsSync(zshrcPath)) {
    content = readFileSync(zshrcPath, "utf-8");
  }

  if (content.includes(BEGIN_MARKER)) {
    // Replace existing
    const startIdx = content.indexOf(BEGIN_MARKER);
    const endIdx = content.indexOf(END_MARKER) + END_MARKER.length;
    content =
      content.slice(0, startIdx) +
      generateZshCompletionScript() +
      content.slice(endIdx);
    writeFileSync(zshrcPath, content);
    console.log(`Updated catladder completions in ${zshrcPath}`);
  } else {
    writeFileSync(
      zshrcPath,
      content + "\n" + generateZshCompletionScript() + "\n",
    );
    console.log(`Installed catladder completions in ${zshrcPath}`);
  }
  console.log(`Restart your shell or run: source ${zshrcPath}`);
}

/**
 * Remove completions from .zshrc.
 */
export async function uninstallCompletions(): Promise<void> {
  const zshrcPath = getZshrcPath();
  if (!existsSync(zshrcPath)) {
    console.log("No .zshrc found");
    return;
  }

  const content = readFileSync(zshrcPath, "utf-8");

  if (!content.includes(BEGIN_MARKER)) {
    console.log("No catladder completions found in " + zshrcPath);
    return;
  }

  const startIdx = content.indexOf(BEGIN_MARKER);
  const endIdx = content.indexOf(END_MARKER) + END_MARKER.length;
  const cleaned = (content.slice(0, startIdx) + content.slice(endIdx)).replace(
    /\n{3,}/g,
    "\n\n",
  );

  writeFileSync(zshrcPath, cleaned);
  console.log(`Removed catladder completions from ${zshrcPath}`);
  console.log(`Restart your shell or run: source ${zshrcPath}`);
}
