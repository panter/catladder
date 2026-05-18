import type {
  CommandContext,
  CommandDef,
  InputDef,
  InputResultType,
  InputsSchema,
} from "../core/types";

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

  abstract log(message: string): void;
  abstract confirm(message: string): Promise<boolean>;

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
  ): Promise<InputResultType<TInputs[K]>> {
    if (!this.cache.has(name)) {
      const spec = this.command.inputs[name];
      if (!spec) {
        return Promise.reject(
          new Error(
            `Input "${name}" is not declared in command "${this.command.name}"`,
          ),
        );
      }
      this.cache.set(name, this.resolveInput(name, spec));
    }
    return this.cache.get(name)!;
  }

  async promptDirect<P extends InputDef>(
    spec: P & { name: string },
  ): Promise<InputResultType<P>> {
    return this.resolveInput(spec.name, spec);
  }
}
