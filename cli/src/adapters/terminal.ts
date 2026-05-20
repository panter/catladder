import type {
  CommandDef,
  IO,
  InputDef,
  InputResultType,
  InputsSchema,
  PromptChoice,
} from "../core/types";
import { MissingInputError } from "../core/types";
import { BaseContext } from "./baseContext";

/**
 * Resolve choices from a choices function.
 */
async function resolveChoices(
  choices: (ctx: any) => PromptChoice[] | Promise<PromptChoice[]>,
  ctx: any,
): Promise<{ name: string; value: string }[]> {
  const raw = await choices(ctx);
  return raw.map((c) => (typeof c === "string" ? { name: c, value: c } : c));
}

/**
 * Prompt the user interactively using @inquirer/prompts.
 * The UI is determined by the value type + presence of choices.
 */
async function promptInteractive<P extends InputDef>(
  spec: P & { name: string },
  ctx: any,
): Promise<InputResultType<P>> {
  const inquirer = await import("@inquirer/prompts");

  switch (spec.type) {
    case "string": {
      if (spec.choices) {
        const choices = await resolveChoices(spec.choices, ctx);
        return inquirer.select({
          message: spec.message,
          choices,
        }) as Promise<InputResultType<P>>;
      }
      return inquirer.input({
        message: spec.message,
        default: spec.default,
      }) as Promise<InputResultType<P>>;
    }
    case "string[]": {
      if (spec.choices) {
        const choices = await resolveChoices(spec.choices, ctx);
        return inquirer.checkbox({
          message: spec.message,
          choices,
        }) as Promise<InputResultType<P>>;
      }
      const raw = await inquirer.input({ message: spec.message });
      return (
        raw ? raw.split(",").map((s: string) => s.trim()) : []
      ) as InputResultType<P>;
    }
    case "number":
      return inquirer.number({
        message: spec.message,
        default: spec.default,
      }) as Promise<InputResultType<P>>;
    case "boolean":
      return inquirer.confirm({
        message: spec.message,
        default: spec.default,
      }) as Promise<InputResultType<P>>;
    default:
      throw new Error(`Unsupported input type: ${(spec as InputDef).type}`);
  }
}

export interface TerminalOptions {
  /** Pre-supplied values from CLI flags/positional args, keyed by input name */
  cliOptions?: Record<string, unknown>;
  /** Pre-supplied values from --inputs JSON flag */
  jsonInputs?: Record<string, unknown>;
  /** Whether interactive prompts are allowed (default: auto-detect from TTY) */
  interactive?: boolean;
  /** If true, all confirm() calls return true without prompting (--yes flag) */
  yes?: boolean;
}

class TerminalContext<
  TInputs extends InputsSchema,
> extends BaseContext<TInputs> {
  constructor(
    command: CommandDef<TInputs>,
    private options: TerminalOptions,
  ) {
    super(command);
  }

  log(message: string): void {
    console.log(message);
  }

  async confirm(message: string): Promise<boolean> {
    if (this.options.yes) return true;
    const isInteractive =
      this.options.interactive ?? process.stdin.isTTY === true;
    if (!isInteractive) return true;
    const inquirer = await import("@inquirer/prompts");
    return inquirer.confirm({ message });
  }

  protected async resolveInput<P extends InputDef>(
    name: string,
    spec: P,
  ): Promise<InputResultType<P>> {
    const { cliOptions = {}, jsonInputs = {}, interactive } = this.options;
    const isInteractive = interactive ?? process.stdin.isTTY === true;

    // Helper: validate a pre-supplied value against choices if they exist
    const validateAgainstChoices = async (value: unknown): Promise<void> => {
      if (!("choices" in spec) || !spec.choices) return;
      const choices = await resolveChoices(spec.choices, this);
      const validValues = choices.map((c) => c.value);
      if (Array.isArray(value)) {
        const invalid = (value as string[]).filter(
          (v) => !validValues.includes(v),
        );
        if (invalid.length > 0) {
          throw new Error(
            `Invalid value(s) for "${name}": ${invalid.join(", ")}. Valid choices: ${validValues.join(", ")}`,
          );
        }
      } else if (!validValues.includes(value as string)) {
        throw new Error(
          `Invalid value for "${name}": "${value}". Valid choices: ${validValues.join(", ")}`,
        );
      }
    };

    // 1. CLI flag or positional arg
    if (name in cliOptions && cliOptions[name] !== undefined) {
      await validateAgainstChoices(cliOptions[name]);
      return cliOptions[name] as InputResultType<P>;
    }

    // 2. JSON inputs
    if (name in jsonInputs && jsonInputs[name] !== undefined) {
      await validateAgainstChoices(jsonInputs[name]);
      return jsonInputs[name] as InputResultType<P>;
    }

    // 3. Default (check before prompting, so optional inputs with defaults don't prompt)
    if ("default" in spec && spec.default !== undefined) {
      return spec.default as InputResultType<P>;
    }

    // 4. Optional inputs: don't prompt, throw so baseContext returns undefined
    if (spec.required === false) {
      throw new MissingInputError(name, spec.message);
    }

    // 5. Interactive prompt
    if (isInteractive) {
      return promptInteractive({ ...spec, name }, this);
    }

    // 6. Throw
    throw new MissingInputError(name, spec.message);
  }
}

/**
 * Create a CommandContext for terminal usage.
 */
export function createTerminalContext<TInputs extends InputsSchema>(
  command: CommandDef<TInputs>,
  options: TerminalOptions = {},
): TerminalContext<TInputs> {
  return new TerminalContext(command, options);
}

/**
 * Create a bare IO instance for terminal helper functions.
 */
export function createTerminalIO(options: TerminalOptions = {}): IO {
  return {
    log(message: string): void {
      console.log(message);
    },
    async confirm(message: string): Promise<boolean> {
      if (options.yes) return true;
      const isInteractive = options.interactive ?? process.stdin.isTTY === true;
      if (!isInteractive) return true;
      const inquirer = await import("@inquirer/prompts");
      return inquirer.confirm({ message });
    },
    async promptDirect<P extends InputDef>(
      spec: P & { name: string },
    ): Promise<InputResultType<P>> {
      const isInteractive = options.interactive ?? process.stdin.isTTY === true;
      if (isInteractive) {
        return promptInteractive(spec, null);
      }
      if ("default" in spec && spec.default !== undefined) {
        return spec.default as InputResultType<P>;
      }
      throw new MissingInputError(spec.name, spec.message);
    },
  };
}
