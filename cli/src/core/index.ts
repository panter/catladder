export type {
  CommandContext,
  CommandDef,
  IO,
  InputDef,
  InputResultType,
  InputsSchema,
  StringInputDef,
  StringArrayInputDef,
  NumberInputDef,
  BooleanInputDef,
  PromptChoice,
  ChoicesFn,
  // Legacy aliases
  PromptDef,
  PromptResultType,
  PromptsSchema,
} from "./types";
export { MissingInputError } from "./types";
export { defineCommand } from "./defineCommand";
export {
  registerCommand,
  getCommand,
  getAllCommands,
  getCommandsByGroup,
} from "./registry";
export { runCommand } from "./runner";
