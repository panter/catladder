// ─── Input Definitions ───────────────────────────────────────────────

export type PromptChoice = string | { name: string; value: string };

/**
 * Function that returns choices for an input.
 * Receives the command context so it can resolve other inputs first.
 */
export type ChoicesFn<TCtx = any> = (
  ctx: TCtx,
) => PromptChoice[] | Promise<PromptChoice[]>;

export type StringInputDef = {
  type: "string";
  message: string;
  default?: string;
  positional?: boolean;
  required?: boolean;
  /** If provided, renders as a list selection in interactive mode */
  choices?: ChoicesFn;
};

export type StringArrayInputDef = {
  type: "string[]";
  message: string;
  positional?: boolean;
  required?: boolean;
  /** If provided, renders as checkboxes in interactive mode */
  choices?: ChoicesFn;
};

export type NumberInputDef = {
  type: "number";
  message: string;
  default?: number;
  positional?: boolean;
  required?: boolean;
};

export type BooleanInputDef = {
  type: "boolean";
  message: string;
  default?: boolean;
  positional?: boolean;
  required?: boolean;
};

export type InputDef =
  | StringInputDef
  | StringArrayInputDef
  | NumberInputDef
  | BooleanInputDef;

/** Map an InputDef to its resolved TypeScript value type */
export type InputResultType<P extends InputDef> = P extends { type: "string" }
  ? string
  : P extends { type: "string[]" }
    ? string[]
    : P extends { type: "number" }
      ? number
      : P extends { type: "boolean" }
        ? boolean
        : never;

// ─── Inputs Schema ──────────────────────────────────────────────────

export type InputsSchema = Record<string, InputDef>;

// ─── IO Interface (for helpers) ──────────────────────────────────────

/**
 * Base IO interface for helper functions that need to log or prompt.
 * Helpers use `promptDirect` for ad-hoc prompts (confirmations, sub-selections)
 * that are NOT part of a command's declared input schema.
 */
export interface IO {
  log(message: string): void;
  /**
   * Ask for confirmation. Returns true/false.
   * Skipped (returns true) when --yes is active.
   * Throws or returns false on decline, depending on the adapter.
   */
  confirm(message: string): Promise<boolean>;
  promptDirect<P extends InputDef>(
    spec: P & { name: string },
  ): Promise<InputResultType<P>>;
}

// ─── Command Context ─────────────────────────────────────────────────

/**
 * Runtime context passed to command execute functions.
 * Extends IO so it can be passed to helpers that only need log + promptDirect.
 *
 * - `get(name)`: consume a declared input by name (type-safe).
 *   Returns the value if already provided (positional arg, CLI flag, JSON),
 *   or prompts for it interactively, or throws if non-interactive.
 * - `log(message)`: output a message.
 * - `promptDirect(spec)`: ad-hoc prompt for helpers (not type-checked against schema).
 */
export interface CommandContext<TInputs extends InputsSchema> extends IO {
  /**
   * Consume a declared input by name.
   * - Compile error if `name` is not in TInputs
   * - Return type matches the input's type (string, number, boolean, string[])
   * - Resolution: pre-supplied value > choices function + interactive prompt > default > throw
   */
  get<K extends keyof TInputs & string>(
    name: K,
  ): Promise<InputResultType<TInputs[K]>>;
}

// ─── Command Definition ──────────────────────────────────────────────

export interface CommandDef<TInputs extends InputsSchema = InputsSchema> {
  name: string;
  description: string;
  group?: string;
  inputs: TInputs;
  execute: (ctx: CommandContext<TInputs>) => Promise<void>;
}

// ─── Errors ──────────────────────────────────────────────────────────

export class MissingInputError extends Error {
  constructor(
    public readonly inputName: string,
    public readonly promptMessage: string,
  ) {
    super(
      `Missing required input: "${inputName}" (${promptMessage}). ` +
        `Provide it via --${inputName}=<value> or --inputs='{"${inputName}": ...}'`,
    );
    this.name = "MissingInputError";
  }
}

// ─── Legacy compatibility aliases ────────────────────────────────────

/** @deprecated Use InputDef */
export type PromptDef = InputDef;
/** @deprecated Use InputResultType */
export type PromptResultType<P extends InputDef> = InputResultType<P>;
/** @deprecated Use InputsSchema */
export type PromptsSchema = InputsSchema;
