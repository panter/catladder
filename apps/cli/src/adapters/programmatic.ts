import type {
  CommandDef,
  IO,
  InputDef,
  InputResultType,
  InputsSchema,
} from "../core/types";
import { MissingInputError } from "../core/types";
import { BaseContext } from "./baseContext";
import { createVaultManagerGetter } from "./vaultManagerAccess";

export interface ProgrammaticOptions {
  /** Pre-supplied values keyed by input name */
  inputs?: Record<string, unknown>;
  /** Called on every log message. Defaults to no-op. */
  onLog?: (message: string) => void;
}

class ProgrammaticContext<
  TInputs extends InputsSchema,
> extends BaseContext<TInputs> {
  private inputs: Record<string, unknown>;
  private onLog?: (message: string) => void;

  readonly interactive = false;

  constructor(command: CommandDef<TInputs>, options: ProgrammaticOptions) {
    super(command);
    this.inputs = options.inputs ?? {};
    this.onLog = options.onLog;
  }

  log(message: string): void {
    this.onLog?.(message);
  }

  async confirm(): Promise<boolean> {
    return true; // programmatic mode always confirms
  }

  protected async resolveInput<P extends InputDef>(
    name: string,
    spec: P,
  ): Promise<InputResultType<P>> {
    if (name in this.inputs && this.inputs[name] !== undefined) {
      return this.inputs[name] as InputResultType<P>;
    }
    if ("default" in spec && spec.default !== undefined) {
      return spec.default as InputResultType<P>;
    }
    throw new MissingInputError(name, spec.message);
  }
}

/**
 * Create a CommandContext that resolves inputs from pre-supplied values.
 * Used for non-interactive CLI mode and programmatic invocation.
 */
export function createProgrammaticContext<TInputs extends InputsSchema>(
  command: CommandDef<TInputs>,
  options: ProgrammaticOptions = {},
): ProgrammaticContext<TInputs> {
  return new ProgrammaticContext(command, options);
}

/**
 * Create a bare IO instance for helper functions that only need log + promptDirect.
 */
export function createProgrammaticIO(options: ProgrammaticOptions = {}): IO {
  const { inputs = {}, onLog } = options;

  const io: IO = {
    interactive: false,
    getVaultManager: createVaultManagerGetter(() => io),
    log(message: string): void {
      onLog?.(message);
    },
    async confirm(): Promise<boolean> {
      return true;
    },
    async promptDirect<P extends InputDef>(
      spec: P & { name: string },
    ): Promise<InputResultType<P>> {
      if (spec.name in inputs && inputs[spec.name] !== undefined) {
        return inputs[spec.name] as InputResultType<P>;
      }
      if ("default" in spec && spec.default !== undefined) {
        return spec.default as InputResultType<P>;
      }
      throw new MissingInputError(spec.name, spec.message);
    },
  };
  return io;
}
