import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import * as commands from "../commands";
import type { CommandDef, InputDef } from "../core/types";

/**
 * renders the CLI command reference of the catladder-cli agent skill
 * from the command definitions, so the skill always documents the
 * commands that actually exist. Runs as part of the cli build
 * (`build:skill-cli-reference`) and writes into the repository's
 * `skills/` directory — commit the result.
 */

const kebab = (name: string) => name.replace(/([A-Z])/g, "-$1").toLowerCase();

const cleanMessage = (message: string) =>
  message.replace(/\s*🤔\s*$/, "").trim();

const renderInput = ([name, def]: [string, InputDef]): string => {
  const description = cleanMessage(def.message);
  const details = [
    def.required ? "required" : undefined,
    "default" in def && def.default !== undefined
      ? `default: ${JSON.stringify(def.default)}`
      : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  const usage = def.positional
    ? `\`${name}\` (positional)`
    : def.type === "boolean"
      ? `\`--${kebab(name)}\``
      : `\`--${kebab(name)} <value>\``;
  return `- ${usage}: ${description}${details ? ` (${details})` : ""}`;
};

const renderCommand = (def: CommandDef): string => {
  const positionals = Object.entries(def.inputs)
    .filter(([, input]) => input.positional)
    .map(([name]) => ` [${name}]`)
    .join("");
  const inputs = Object.entries(def.inputs);
  return [
    `## \`catladder ${def.name}${positionals}\``,
    "",
    def.description,
    ...(inputs.length > 0 ? ["", ...inputs.map(renderInput)] : []),
  ].join("\n");
};

const isCommandDef = (value: unknown): value is CommandDef =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  "execute" in value;

export const renderCliReference = (): string => {
  const defs = Object.values(commands)
    .filter(isCommandDef)
    .sort((a, b) => a.name.localeCompare(b.name));
  return [
    "# catladder CLI command reference",
    "",
    "<!-- rendered from the command definitions by",
    "     apps/cli/src/scripts/generateCliSkillReference.ts — do not edit -->",
    "",
    "All commands run non-interactively as `yarn catladder <command> ...`;",
    "see SKILL.md for how to pass inputs.",
    "",
    defs.map(renderCommand).join("\n\n"),
    "",
  ].join("\n");
};

// executed by the cli build via tsx (node itself cannot require the
// ESM-only deps of the command modules on older versions)
const main = () => {
  const repoRootCandidates = [
    join(__dirname, "../../../.."), // source: apps/cli/src/scripts
    join(__dirname, "../../../../../../.."), // compiled: apps/cli/dist/apps/cli/src/scripts
  ];
  const repoRoot = repoRootCandidates.find((candidate) =>
    existsSync(join(candidate, "skills")),
  );
  if (!repoRoot) {
    throw new Error("skills directory not found next to the cli workspace");
  }
  const target = join(
    repoRoot,
    "skills",
    "catladder-cli",
    "references",
    "commands.md",
  );
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, renderCliReference(), "utf-8");
  console.log(`wrote ${target}`);
};

if (require.main === module) {
  main();
}
