import type { CommandDef, InputDef } from "./types";

/**
 * Type-safe builder for command definitions.
 * Infers TInputs from the definition object so that
 * `ctx.get("...")` is fully typed.
 *
 * @example
 * ```ts
 * export const myCommand = defineCommand({
 *   name: "my-command",
 *   description: "Does something",
 *   inputs: {
 *     envComponent: { type: "string", message: "env:component", positional: true },
 *     podName: { type: "string", message: "Which pod?", choices: async () => ["a", "b"] },
 *     mr: { type: "number", message: "Which MR?" },
 *     confirmed: { type: "boolean", message: "Continue?" },
 *   },
 *   execute: async (ctx) => {
 *     const env = await ctx.get("envComponent");  // string
 *     const pod = await ctx.get("podName");        // string
 *     const mr = await ctx.get("mr");              // number
 *     const ok = await ctx.get("confirmed");       // boolean
 *   },
 * });
 * ```
 */
export function defineCommand<const TInputs extends Record<string, InputDef>>(
  def: CommandDef<TInputs>,
): CommandDef<TInputs> {
  return def;
}
