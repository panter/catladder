import type { CommandDef, InputsSchema } from "./types";
import { createProgrammaticContext } from "../adapters/programmatic";

/**
 * Run a command programmatically.
 * This is the main entry point for calling commands from code.
 *
 * @example
 * ```ts
 * import { commandPortForward } from "./commands/project/portForward";
 * import { runCommand } from "./core/runner";
 *
 * await runCommand(commandPortForward, {
 *   inputs: { envComponent: "dev:web", podName: "web-abc", localPort: 3000, remotePort: 3000 },
 * });
 * ```
 */
export async function runCommand<TInputs extends InputsSchema>(
  command: CommandDef<TInputs>,
  options: {
    inputs?: Record<string, unknown>;
    onLog?: (message: string) => void;
  } = {},
): Promise<void> {
  const ctx = createProgrammaticContext(command, {
    inputs: options.inputs,
    onLog: options.onLog,
  });

  await command.execute(ctx);
}
