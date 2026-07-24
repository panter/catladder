import type { CommandDef } from "./types";

const commands: Map<string, CommandDef> = new Map();

export function registerCommand(def: CommandDef): void {
  if (commands.has(def.name)) {
    throw new Error(`Command "${def.name}" is already registered`);
  }
  commands.set(def.name, def);
}

export function getCommand(name: string): CommandDef | undefined {
  return commands.get(name);
}

export function getAllCommands(): CommandDef[] {
  return Array.from(commands.values());
}

export function getCommandsByGroup(group: string): CommandDef[] {
  return getAllCommands().filter((c) => c.group === group);
}
