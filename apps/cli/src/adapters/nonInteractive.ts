import type { IO } from "../core/types";
import { NonInteractiveError } from "../core/types";
import type { SecretsMode } from "../vault";
import { createVaultManagerGetter } from "./vaultManagerAccess";

/**
 * the context of non-interactive runs (catenv via direnv): logging
 * goes to stderr, any required interaction fails with a clear error.
 */
export function createNonInteractiveIO(
  options: { vaultMode?: SecretsMode } = {},
): IO {
  const io: IO = {
    interactive: false,
    getVaultManager: createVaultManagerGetter(() => io, {
      mode: options.vaultMode,
    }),
    log(message: string): void {
      // stderr: stdout may be evaluated (direnv)
      console.error(message);
    },
    async confirm(message: string): Promise<boolean> {
      throw new NonInteractiveError(`confirmation ("${message}")`);
    },
    async promptDirect(spec): Promise<never> {
      throw new NonInteractiveError(`input "${spec.name}"`);
    },
  };
  return io;
}
