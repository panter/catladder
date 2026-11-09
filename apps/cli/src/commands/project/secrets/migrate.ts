import { getSecretVarName } from "@catladder/pipeline";
import type { IO } from "../../../core/types";
import type { SecretsVault } from "../../../vault/types";
import { FILL_ME } from "./document";
import type { ScopedSecretKeys } from "./scope";

/**
 * Core of `secrets-migrate`: copies declared secrets from one vault to
 * another. Pure and injectable (vaults are passed in), so it is testable
 * with fake vaults. Secret values are only ever carried around as raw
 * strings and are never part of any log line or error message.
 */

export type MigrationAction =
  /** not in the target (or an unset placeholder there): will be written */
  | "create"
  /** differs in the target and `overwrite` is set: will be written */
  | "overwrite"
  /** differs in the target, no `overwrite`: left alone, migration incomplete */
  | "conflict"
  /** target already has the same value */
  | "equal"
  /** no value in the source: nothing to copy */
  | "unset";

export type MigrationEntry = {
  env: string;
  componentName: string;
  key: string;
  action: MigrationAction;
  /** raw source value, set for create/overwrite/conflict/equal */
  value?: string;
};

/** `env:component:KEY`, the way entries are reported */
export const entryName = (e: {
  env: string;
  componentName: string;
  key: string;
}) => `${e.env}:${e.componentName}:${e.key}`;

export type MigrationResult = {
  created: string[];
  overwritten: string[];
  /** equal in the target, or unset in the source */
  skipped: string[];
  conflicts: string[];
  failed: string[];
};

/**
 * Unset handling is deliberately a bit different from
 * `collectSecretsWrites`: that one works on parsed documents (JSON
 * `null` counts as unset). Migration copies raw strings 1:1, so the
 * literal string "null" is a value and is copied; absent, empty and the
 * FILL_ME placeholder are unset.
 */
const isUnset = (value: string | undefined): value is undefined =>
  value === undefined || value === "" || value === FILL_ME;

export const planMigration = (
  scoped: ScopedSecretKeys,
  sourceValues: Record<string, string>,
  targetValues: Record<string, string>,
  { overwrite }: { overwrite: boolean },
): MigrationEntry[] =>
  scoped.flatMap(({ env, componentName, keys }) =>
    keys.map((key): MigrationEntry => {
      const rawName = getSecretVarName(env, componentName, key);
      const base = { env, componentName, key };
      const source = sourceValues[rawName];
      if (isUnset(source)) {
        return { ...base, action: "unset" };
      }
      const target = targetValues[rawName];
      if (isUnset(target)) {
        return { ...base, action: "create", value: source };
      }
      if (target === source) {
        return { ...base, action: "equal", value: source };
      }
      return {
        ...base,
        action: overwrite ? "overwrite" : "conflict",
        value: source,
      };
    }),
  );

const count = (plan: MigrationEntry[], action: MigrationAction) =>
  plan.filter((e) => e.action === action).length;

/** names and counts only, never values */
export const formatPlan = (plan: MigrationEntry[]): string => {
  const symbols: Record<MigrationAction, string> = {
    create: "+ create   ",
    overwrite: "~ overwrite",
    conflict: "! conflict ",
    equal: "= equal    ",
    unset: "- unset    ",
  };
  const lines = plan.map((e) => `${symbols[e.action]} ${entryName(e)}`);
  const summary =
    `${count(plan, "create")} to create, ${count(plan, "overwrite")} to overwrite, ` +
    `${count(plan, "conflict")} conflicts, ${count(plan, "equal")} equal, ${count(plan, "unset")} unset`;
  return [...lines, "", summary].join("\n");
};

export const emptyResult = (): MigrationResult => ({
  created: [],
  overwritten: [],
  skipped: [],
  conflicts: [],
  failed: [],
});

/** removes every known secret value from an error message */
const sanitize = (message: string, plan: MigrationEntry[]): string =>
  plan
    .filter((e) => e.value)
    .map((e) => e.value as string)
    // longest first, so a value that contains another one is fully masked
    .sort((a, b) => b.length - a.length)
    .reduce((m, v) => m.split(v).join("***"), message);

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

/**
 * writes create/overwrite entries per env:component with `backup: true`
 * (the previous value is a hand-written secret's only undo). A failing
 * env:component is reported and the others continue.
 */
export const executeMigration = async (
  io: IO,
  plan: MigrationEntry[],
  target: SecretsVault,
): Promise<MigrationResult> => {
  const result = emptyResult();
  for (const e of plan) {
    if (e.action === "equal" || e.action === "unset") {
      result.skipped.push(entryName(e));
    } else if (e.action === "conflict") {
      result.conflicts.push(entryName(e));
    }
  }

  const groups = new Map<
    string,
    { env: string; componentName: string; entries: MigrationEntry[] }
  >();
  for (const e of plan) {
    if (e.action !== "create" && e.action !== "overwrite") continue;
    const id = `${e.env}:${e.componentName}`;
    const group = groups.get(id) ?? {
      env: e.env,
      componentName: e.componentName,
      entries: [],
    };
    group.entries.push(e);
    groups.set(id, group);
  }

  for (const [id, { env, componentName, entries }] of groups) {
    try {
      await target.writeSecrets(
        io,
        env,
        componentName,
        Object.fromEntries(entries.map((e) => [e.key, e.value])),
        { backup: true },
      );
      for (const e of entries) {
        (e.action === "create" ? result.created : result.overwritten).push(
          entryName(e),
        );
      }
    } catch (error) {
      io.log(
        `❌ failed to write ${id}: ${sanitize(errorMessage(error), plan)}`,
      );
      result.failed.push(...entries.map(entryName));
    }
  }
  return result;
};

/**
 * reads the target back once and compares every written entry with the
 * source value. Mismatches (or an unreadable target) move the entry from
 * created/overwritten to failed.
 */
export const verifyMigration = async (
  io: IO,
  plan: MigrationEntry[],
  result: MigrationResult,
  target: SecretsVault,
): Promise<MigrationResult> => {
  const written = plan.filter((e) => {
    const name = entryName(e);
    return result.created.includes(name) || result.overwritten.includes(name);
  });
  if (written.length === 0) return result;

  let actual: Record<string, string> | null = null;
  try {
    actual = await target.readAllSecrets(io);
  } catch (error) {
    io.log(
      `❌ could not read back the target for verification: ${sanitize(errorMessage(error), plan)}`,
    );
  }

  const bad = new Set(
    written
      .filter(
        (e) =>
          actual === null ||
          actual[getSecretVarName(e.env, e.componentName, e.key)] !== e.value,
      )
      .map(entryName),
  );
  return {
    ...result,
    created: result.created.filter((n) => !bad.has(n)),
    overwritten: result.overwritten.filter((n) => !bad.has(n)),
    failed: [...result.failed, ...bad],
  };
};

/** execute + verify */
export const runMigration = async (
  io: IO,
  plan: MigrationEntry[],
  target: SecretsVault,
): Promise<MigrationResult> =>
  verifyMigration(io, plan, await executeMigration(io, plan, target), target);

/** names only, never values */
export const formatResult = (result: MigrationResult): string =>
  [
    `created: ${result.created.length}`,
    `overwritten: ${result.overwritten.length}`,
    `skipped: ${result.skipped.length}`,
    `conflicts: ${result.conflicts.length}${result.conflicts.length ? ` (${result.conflicts.join(", ")}; re-run with --overwrite)` : ""}`,
    `failed: ${result.failed.length}${result.failed.length ? ` (${result.failed.join(", ")})` : ""}`,
  ].join("\n");
