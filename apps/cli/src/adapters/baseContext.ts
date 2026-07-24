import type {
  CommandContext,
  CommandDef,
  InputDef,
  InputResultType,
  InputsSchema,
  OptionalInput,
} from "../core/types";
import type { VaultManager } from "../vault/VaultManager";
import { createVaultManagerGetter } from "./vaultManagerAccess";

/**
 * Base class for CommandContext implementations.
 * Handles caching, the `get()` method, and `promptDirect` delegation.
 * Subclasses only implement the adapter-specific resolution logic.
 */
export abstract class BaseContext<TInputs extends InputsSchema>
  implements CommandContext<TInputs>
{
  private cache = new Map<string, Promise<any>>();

  constructor(protected readonly command: CommandDef<TInputs>) {}

  abstract readonly interactive: boolean;

  abstract log(message: string): void;
  abstract confirm(message: string): Promise<boolean>;

  private readonly vaultManagerGetter = createVaultManagerGetter(() => this);

  getVaultManager(): Promise<VaultManager> {
    return this.vaultManagerGetter();
  }

  /**
   * Resolve a single input value. Called once per input (result is cached).
   * Implementations check pre-supplied values, prompt interactively, use defaults, or throw.
   */
  protected abstract resolveInput<P extends InputDef>(
    name: string,
    spec: P,
  ): Promise<InputResultType<P>>;

  get<K extends keyof TInputs & string>(
    name: K,
  ): Promise<OptionalInput<TInputs[K]>> {
    if (!this.cache.has(name)) {
      const spec = this.command.inputs[name];
      if (!spec) {
        return Promise.reject(
          new Error(
            `Input "${name}" is not declared in command "${this.command.name}"`,
          ),
        );
      }
      // For optional inputs (required: false), catch MissingInputError
      // and return undefined instead of prompting
      if (spec.required === false) {
        this.cache.set(
          name,
          this.resolveInput(name, spec).catch((err) => {
            if (err?.name === "MissingInputError") return undefined;
            throw err;
          }),
        );
      } else {
        this.cache.set(name, this.resolveInput(name, spec));
      }
    }
    return this.cache.get(name)!;
  }

  async promptDirect<P extends InputDef>(
    spec: P & { name: string },
  ): Promise<InputResultType<P>> {
    return this.resolveInput(spec.name, spec);
  }
}
